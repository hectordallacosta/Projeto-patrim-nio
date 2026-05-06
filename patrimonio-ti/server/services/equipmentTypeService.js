const EquipmentType = require('../models/EquipmentType');
const Equipment = require('../models/Equipment');
const auditService = require('./auditService');

async function list() {
  return EquipmentType.find().sort({ name: 1 });
}

async function create(data, userId, ip) {
  const equipmentType = await EquipmentType.create(data);
  await auditService.log({
    action: 'CREATE',
    entity: 'EquipmentType',
    entityId: equipmentType._id,
    performedBy: userId,
    after: equipmentType.toObject(),
    ip,
  });
  return equipmentType;
}

async function update(id, data, userId, ip) {
  const before = await EquipmentType.findById(id).lean();
  if (!before) {
    const err = new Error('Tipo de equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const updated = await EquipmentType.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  await auditService.log({
    action: 'UPDATE',
    entity: 'EquipmentType',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

async function remove(id, userId, ip) {
  const equipmentType = await EquipmentType.findById(id).lean();
  if (!equipmentType) {
    const err = new Error('Tipo de equipamento não encontrado');
    err.statusCode = 404;
    throw err;
  }

  // Bloqueia se houver equipamentos usando este tipo
  const equipments = await Equipment.find({ type: id }).select('brand model serialNumber').lean();
  if (equipments.length) {
    const err = new Error('Tipo de equipamento em uso — remova os equipamentos vinculados antes de excluir');
    err.statusCode = 409;
    err.code = 'EQUIPMENT_TYPE_IN_USE';
    err.details = equipments;
    throw err;
  }

  await EquipmentType.findByIdAndDelete(id);
  await auditService.log({
    action: 'DELETE',
    entity: 'EquipmentType',
    entityId: id,
    performedBy: userId,
    before: equipmentType,
    ip,
  });
}

module.exports = { list, create, update, remove };
