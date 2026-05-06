const Equipment = require('../models/Equipment');
const EquipmentModel = require('../models/EquipmentModel');
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
];

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.assignedSector) filter.assignedSector = query.assignedSector;

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
  const equipment = await Equipment.create(data);
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
    });
  }

  equipment.assignedTo = assignedTo || null;
  equipment.assignedSector = assignedSector || null;
  equipment.assignmentDate = now;
  equipment.status = 'assigned';

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
 * Remove o vínculo do equipamento e registra no histórico.
 */
async function unassign(id, note = '', userId, ip) {
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

  const before = equipment.toObject();
  const now = new Date();

  equipment.assignmentHistory.push({
    assignedTo: equipment.assignedTo,
    assignedSector: equipment.assignedSector,
    assignedAt: equipment.assignmentDate,
    returnedAt: now,
    note,
  });

  equipment.assignedTo = null;
  equipment.assignedSector = null;
  equipment.assignmentDate = null;
  equipment.status = 'available';

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

async function updateStatus(id, status, userId, ip) {
  const equipment = await Equipment.findById(id);
  if (!equipment) {
    const err = new Error('Equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  // Não permite colocar em manutenção/desativado se ainda vinculado
  if (['maintenance', 'decommissioned'].includes(status) && (equipment.assignedTo || equipment.assignedSector)) {
    const err = new Error('Desvincule o equipamento antes de alterar o status para ' + status);
    err.statusCode = 409;
    err.code = 'EQUIPMENT_UNAVAILABLE';
    throw err;
  }

  const before = equipment.toObject();
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

module.exports = { list, getById, create, update, assign, unassign, updateStatus, remove };
