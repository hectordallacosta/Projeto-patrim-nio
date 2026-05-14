const Equipment = require('../models/Equipment');
const EquipmentModel = require('../models/EquipmentModel');
const User = require('../models/User');
const Sector = require('../models/Sector');
const Stock = require('../models/Stock');
const auditService = require('./auditService');
const { paginate, paginationMeta } = require('../utils/pagination');

const POPULATE_FIELDS = [
  {
    path: 'equipmentModel',
    select: 'brand model lot type purchaseDate warrantyExpiry',
    populate: { path: 'type', select: 'name' },
  },
  { path: 'assignedTo', select: 'displayName username email' },
  { path: 'assignedSector', select: 'name' },
  { path: 'stock', select: 'name' },
];

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  } else {
    // Por padrão, oculta equipamentos em estoque (gerenciados pela aba Estoques)
    filter.status = { $ne: 'in_stock' };
  }
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.assignedSector) filter.assignedSector = query.assignedSector;
  if (query.stock) filter.stock = query.stock;

  // Filtros que dependem de campos do EquipmentModel (type, search em brand/model/lot)
  if (query.type || query.search) {
    const modelQuery = {};
    if (query.type) modelQuery.type = query.type;
    if (query.search) {
      modelQuery.$or = [
        { brand: { $regex: query.search, $options: 'i' } },
        { model: { $regex: query.search, $options: 'i' } },
        { lot: { $regex: query.search, $options: 'i' } },
      ];
    }
    const matchingModels = await EquipmentModel.find(modelQuery).select('_id').lean();
    const matchingModelIds = matchingModels.map((m) => m._id);

    if (query.search) {
      // Busca em série/patrimônio OU nos modelos correspondentes
      filter.$or = [
        { serialNumber: { $regex: query.search, $options: 'i' } },
        { patrimonyNumber: { $regex: query.search, $options: 'i' } },
        { equipmentModel: { $in: matchingModelIds } },
      ];
    } else {
      filter.equipmentModel = { $in: matchingModelIds };
    }
  }

  const SORTABLE = ['serialNumber', 'patrimonyNumber', 'status', 'createdAt'];
  const sortField = SORTABLE.includes(query.sort) ? query.sort : 'createdAt';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;

  const [data, total] = await Promise.all([
    Equipment.find(filter).populate(POPULATE_FIELDS).sort({ [sortField]: sortDir }).skip(skip).limit(limit),
    Equipment.countDocuments(filter),
  ]);

  return { data, pagination: paginationMeta(total, page, limit) };
}

async function getById(id) {
  const equipment = await Equipment.findById(id)
    .populate(POPULATE_FIELDS)
    .populate('assignmentHistory.assignedTo', 'displayName username')
    .populate('assignmentHistory.assignedSector', 'name');

  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }
  return equipment;
}

async function create(data, userId, ip) {
  if (!data.stock) {
    const err = new Error('Informe o estoque de destino para o equipamento.');
    err.statusCode = 400;
    throw err;
  }

  const stock = await Stock.findById(data.stock);
  if (!stock) {
    const err = new Error('Estoque não encontrado.');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }

  const payload = { ...data, status: 'in_stock', assignedTo: null, assignedSector: null };
  const equipment = await Equipment.create(payload);
  await auditService.log({
    action: 'CREATE',
    entity: 'Equipment',
    entityId: equipment._id,
    performedBy: userId,
    after: equipment.toObject(),
    ip,
  });
  return equipment.populate(POPULATE_FIELDS);
}

async function update(id, data, userId, ip) {
  // campos de vínculo não podem ser alterados por esta rota — use assign/unassign
  const forbidden = ['assignedTo', 'assignedSector', 'assignmentDate', 'assignmentHistory', 'status'];
  forbidden.forEach((f) => delete data[f]);

  const before = await Equipment.findById(id).lean();
  if (!before) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const updated = await Equipment.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate(POPULATE_FIELDS);
  await auditService.log({
    action: 'UPDATE',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

/**
 * Vincula o equipamento a um usuário OU a um setor.
 * Regras: status deve ser 'available', apenas um destino por vez.
 */
async function assign(id, { assignedTo, assignedSector, note = '' }, userId, ip) {
  if (!assignedTo && !assignedSector) {
    const err = new Error('Informe um usuário ou setor para vincular');
    err.statusCode = 400;
    throw err;
  }
  if (assignedTo && assignedSector) {
    const err = new Error('O equipamento deve ser vinculado a um usuário OU a um setor, não ambos');
    err.statusCode = 400;
    throw err;
  }

  const equipment = await Equipment.findById(id);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (['maintenance', 'decommissioned'].includes(equipment.status)) {
    const err = new Error(`Equipamento com status "${equipment.status}" não pode ser vinculado`);
    err.statusCode = 409;
    err.code = 'EQUIPMENT_UNAVAILABLE';
    throw err;
  }

  const fromStock = equipment.status === 'in_stock' ? equipment.stock : null;

  if (assignedTo) {
    const targetUser = await User.findById(assignedTo).select('isActive displayName').lean();
    if (!targetUser) {
      const err = new Error('Usuário não encontrado.');
      err.statusCode = 404;
      throw err;
    }
    if (!targetUser.isActive) {
      const err = new Error(`O usuário "${targetUser.displayName}" está desativado e não pode receber equipamentos.`);
      err.statusCode = 422;
      err.code = 'USER_INACTIVE';
      throw err;
    }
  }

  const before = equipment.toObject();
  const now = new Date();

  // Encerra vínculo anterior no histórico
  if (equipment.assignedTo || equipment.assignedSector) {
    equipment.assignmentHistory.push({
      assignedTo: equipment.assignedTo,
      assignedSector: equipment.assignedSector,
      assignedAt: equipment.assignmentDate,
      returnedAt: now,
      note,
      action: 'assigned',
    });
  }

  equipment.assignedTo = assignedTo || null;
  equipment.assignedSector = assignedSector || null;
  equipment.assignmentDate = now;
  equipment.status = 'assigned';
  // Se veio do estoque, zera o campo stock
  if (fromStock) equipment.stock = null;

  await equipment.save();
  await auditService.log({
    action: 'ASSIGN',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before,
    after: equipment.toObject(),
    ip,
  });

  return equipment.populate(POPULATE_FIELDS);
}

/**
 * Remove o vínculo do equipamento e move para um estoque obrigatório.
 */
async function unassign(id, { stockId, note = '' }, userId, ip) {
  const equipment = await Equipment.findById(id);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (!equipment.assignedTo && !equipment.assignedSector) {
    const err = new Error('Equipamento não está vinculado a nenhum usuário ou setor');
    err.statusCode = 409;
    throw err;
  }

  const stock = await Stock.findById(stockId);
  if (!stock || !stock.isActive) {
    const err = new Error('Estoque de destino não encontrado ou inativo.');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }

  const before = equipment.toObject();
  const now = new Date();

  equipment.assignmentHistory.push({
    assignedTo: equipment.assignedTo,
    assignedSector: equipment.assignedSector,
    assignedAt: equipment.assignmentDate,
    returnedAt: now,
    note,
    action: 'unassigned_to_stock',
  });

  equipment.assignedTo = null;
  equipment.assignedSector = null;
  equipment.assignmentDate = null;
  equipment.status = 'in_stock';
  equipment.stock = stockId;

  await equipment.save();
  await auditService.log({
    action: 'UNASSIGN',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before,
    after: equipment.toObject(),
    ip,
  });

  return equipment.populate(POPULATE_FIELDS);
}

/**
 * Move um equipamento para um estoque, encerrando qualquer vínculo ativo.
 * Aceita equipamentos com status available, assigned ou in_stock (mudança de estoque).
 */
async function sendToStock(equipmentId, stockId, userId, ip) {
  const equipment = await Equipment.findById(equipmentId);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (equipment.status === 'in_stock' && equipment.stock?.toString() === stockId) {
    const err = new Error('Equipamento já está neste estoque.');
    err.statusCode = 422;
    err.code = 'EQUIPMENT_ALREADY_IN_STOCK';
    throw err;
  }

  if (equipment.status === 'decommissioned') {
    const err = new Error('Equipamento baixado (decommissioned) não pode ser movido para estoque.');
    err.statusCode = 409;
    err.code = 'EQUIPMENT_UNAVAILABLE';
    throw err;
  }

  const stock = await Stock.findById(stockId);
  if (!stock || !stock.isActive) {
    const err = new Error('Estoque de destino não encontrado ou inativo.');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }

  const before = equipment.toObject();
  const now = new Date();

  if (equipment.assignedTo || equipment.assignedSector) {
    equipment.assignmentHistory.push({
      assignedTo: equipment.assignedTo,
      assignedSector: equipment.assignedSector,
      assignedAt: equipment.assignmentDate,
      returnedAt: now,
      action: 'sent_to_stock',
    });
  }

  equipment.status = 'in_stock';
  equipment.stock = stockId;
  equipment.assignedTo = null;
  equipment.assignedSector = null;
  equipment.assignmentDate = null;

  await equipment.save();
  await auditService.log({
    action: 'EQUIPMENT_SENT_TO_STOCK',
    entity: 'Equipment',
    entityId: equipmentId,
    performedBy: userId,
    before,
    after: equipment.toObject(),
    ip,
  });

  return equipment.populate(POPULATE_FIELDS);
}

async function updateStatus(id, status, userId, ip) {
  const equipment = await Equipment.findById(id);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  // decommissioned exige desvinculação prévia; maintenance auto-desvincula
  if (status === 'decommissioned' && (equipment.assignedTo || equipment.assignedSector)) {
    const err = new Error('Desvincule o equipamento antes de dar baixa.');
    err.statusCode = 409;
    err.code = 'EQUIPMENT_UNAVAILABLE';
    throw err;
  }

  const before = equipment.toObject();
  const now = new Date();

  // Se em uso, encerra o vínculo ao colocar em manutenção
  if (status === 'maintenance' && (equipment.assignedTo || equipment.assignedSector)) {
    equipment.assignmentHistory.push({
      assignedTo: equipment.assignedTo,
      assignedSector: equipment.assignedSector,
      assignedAt: equipment.assignmentDate,
      returnedAt: now,
      action: 'sent_to_maintenance',
    });
    equipment.assignedTo = null;
    equipment.assignedSector = null;
    equipment.assignmentDate = null;
    equipment.stock = null;
  }

  equipment.status = status;
  await equipment.save();

  await auditService.log({
    action: 'STATUS_CHANGE',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before,
    after: equipment.toObject(),
    ip,
  });

  return equipment.populate(POPULATE_FIELDS);
}

/**
 * Retira o equipamento do estoque, tornando-o disponível no setor informado.
 */
async function retrieve(id, sectorId, userId, ip) {
  const equipment = await Equipment.findById(id);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  if (equipment.status !== 'in_stock') {
    const err = new Error('Equipamento não está em estoque.');
    err.statusCode = 422;
    err.code = 'EQUIPMENT_NOT_IN_STOCK';
    throw err;
  }

  const sector = await Sector.findById(sectorId);
  if (!sector || !sector.isActive) {
    const err = new Error('Setor não encontrado ou inativo.');
    err.statusCode = 404;
    err.code = 'SECTOR_NOT_FOUND';
    throw err;
  }

  const before = equipment.toObject();
  const now = new Date();

  equipment.assignmentHistory.push({
    assignedTo: null,
    assignedSector: sectorId,
    assignedAt: now,
    returnedAt: now,
    fromStock: equipment.stock,
    action: 'retrieved_from_stock',
  });

  equipment.status = 'available';
  equipment.assignedSector = sectorId;
  equipment.stock = null;
  equipment.assignmentDate = now;

  await equipment.save();
  await auditService.log({
    action: 'EQUIPMENT_RETRIEVED',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before,
    after: equipment.toObject(),
    ip,
  });

  return equipment.populate(POPULATE_FIELDS);
}

async function remove(id, userId, ip) {
  const equipment = await Equipment.findById(id).lean();
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  await Equipment.findByIdAndDelete(id);
  await auditService.log({
    action: 'DELETE',
    entity: 'Equipment',
    entityId: id,
    performedBy: userId,
    before: equipment,
    ip,
  });
}

async function getInStockCount() {
  return Equipment.countDocuments({ status: 'in_stock' });
}

async function getAssetsBySector() {
  const [bySector, byUser] = await Promise.all([
    Equipment.aggregate([
      { $match: { status: 'assigned', assignedSector: { $ne: null } } },
      { $group: { _id: '$assignedSector', total: { $sum: 1 } } },
      { $lookup: { from: 'sectors', localField: '_id', foreignField: '_id', as: 'sector' } },
      { $unwind: '$sector' },
      { $project: { _id: 0, sector: '$sector.name', total: 1 } },
    ]),
    Equipment.aggregate([
      { $match: { status: 'assigned', assignedTo: { $ne: null } } },
      { $lookup: { from: 'users', localField: 'assignedTo', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: { _id: '$user.sector', total: { $sum: 1 } } },
      { $match: { _id: { $ne: null } } },
      { $lookup: { from: 'sectors', localField: '_id', foreignField: '_id', as: 'sector' } },
      { $unwind: '$sector' },
      { $project: { _id: 0, sector: '$sector.name', total: 1 } },
    ]),
  ]);

  const totals = {};
  [...bySector, ...byUser].forEach(({ sector, total }) => {
    totals[sector] = (totals[sector] || 0) + total;
  });

  return Object.entries(totals)
    .map(([sector, total]) => ({ sector, total }))
    .sort((a, b) => b.total - a.total);
}

async function getAssetsByType() {
  return Equipment.aggregate([
    { $match: { status: { $nin: ['decommissioned'] } } },
    { $lookup: { from: 'equipmentmodels', localField: 'equipmentModel', foreignField: '_id', as: 'model' } },
    { $unwind: '$model' },
    { $lookup: { from: 'equipmenttypes', localField: 'model.type', foreignField: '_id', as: 'type' } },
    { $unwind: '$type' },
    { $group: { _id: '$type.name', total: { $sum: 1 } } },
    { $project: { _id: 0, type: '$_id', total: 1 } },
    { $sort: { total: -1 } },
  ]);
}

async function getModelsBySector() {
  return Equipment.aggregate([
    { $match: { status: 'assigned', assignedSector: { $ne: null } } },
    { $lookup: { from: 'equipmentmodels', localField: 'equipmentModel', foreignField: '_id', as: 'model' } },
    { $unwind: '$model' },
    { $lookup: { from: 'sectors', localField: 'assignedSector', foreignField: '_id', as: 'sector' } },
    { $unwind: '$sector' },
    {
      $group: {
        _id: { sector: '$sector.name', model: { $concat: ['$model.brand', ' ', '$model.model'] } },
        total: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.sector',
        models: { $push: { model: '$_id.model', total: '$total' } },
        totalAssets: { $sum: '$total' },
      },
    },
    { $project: { _id: 0, sector: '$_id', models: 1, totalAssets: 1 } },
    { $sort: { totalAssets: -1 } },
  ]);
}

async function getRecentAssignments() {
  return Equipment.find({ status: 'assigned' })
    .sort({ updatedAt: -1 })
    .limit(10)
    .populate('equipmentModel', 'brand model')
    .populate('assignedTo', 'displayName')
    .populate('assignedSector', 'name')
    .lean();
}

module.exports = { list, getById, create, update, assign, unassign, sendToStock, updateStatus, retrieve, remove, getAssetsBySector, getAssetsByType, getModelsBySector, getRecentAssignments, getInStockCount };
