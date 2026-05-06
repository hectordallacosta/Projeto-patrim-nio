const EquipmentModel = require('../models/EquipmentModel');
const Equipment = require('../models/Equipment');
const auditService = require('./auditService');
const { paginate, paginationMeta } = require('../utils/pagination');

const POPULATE = { path: 'type', select: 'name' };

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.type) filter.type = query.type;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { brand: { $regex: query.search, $options: 'i' } },
      { model: { $regex: query.search, $options: 'i' } },
      { lot: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    EquipmentModel.find(filter).populate(POPULATE).sort({ brand: 1, model: 1 }).skip(skip).limit(limit),
    EquipmentModel.countDocuments(filter),
  ]);

  const modelIds = data.map((m) => m._id);
  const counts = await Equipment.aggregate([
    { $match: { equipmentModel: { $in: modelIds } } },
    { $group: { _id: '$equipmentModel', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  const dataWithCounts = data.map((m) => ({
    ...m.toObject(),
    equipmentCount: countMap[m._id.toString()] || 0,
  }));

  return { data: dataWithCounts, pagination: paginationMeta(total, page, limit) };
}

async function listAll() {
  return EquipmentModel.find({ isActive: true }).populate(POPULATE).sort({ brand: 1, model: 1 });
}

async function getById(id) {
  const m = await EquipmentModel.findById(id).populate(POPULATE);
  if (!m) {
    const err = new Error('Modelo de equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }
  return m;
}

async function create(data, userId, ip) {
  const m = await EquipmentModel.create(data);
  await auditService.log({
    action: 'CREATE',
    entity: 'EquipmentModel',
    entityId: m._id,
    performedBy: userId,
    after: m.toObject(),
    ip,
  });
  return m.populate(POPULATE);
}

async function update(id, data, userId, ip) {
  const before = await EquipmentModel.findById(id).lean();
  if (!before) {
    const err = new Error('Modelo de equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const updated = await EquipmentModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate(POPULATE);
  await auditService.log({
    action: 'UPDATE',
    entity: 'EquipmentModel',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

async function remove(id, userId, ip) {
  const count = await Equipment.countDocuments({ equipmentModel: id });
  if (count > 0) {
    const err = new Error(`Não é possível excluir: ${count} equipamento(s) vinculado(s) a este modelo`);
    err.statusCode = 409;
    err.code = 'EQUIPMENT_MODEL_IN_USE';
    throw err;
  }

  const m = await EquipmentModel.findById(id).lean();
  if (!m) {
    const err = new Error('Modelo de equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  await EquipmentModel.findByIdAndDelete(id);
  await auditService.log({
    action: 'DELETE',
    entity: 'EquipmentModel',
    entityId: id,
    performedBy: userId,
    before: m,
    ip,
  });
}

module.exports = { list, listAll, getById, create, update, remove };
