const Sector = require('../models/Sector');
const User = require('../models/User');
const Equipment = require('../models/Equipment');
const auditService = require('./auditService');
const { paginate, paginationMeta } = require('../utils/pagination');

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };
  if (query.hasManager === 'true') filter.manager = { $ne: null };
  if (query.hasManager === 'false') filter.manager = null;

  const [data, total] = await Promise.all([
    Sector.find(filter)
      .populate('manager', 'displayName username')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    Sector.countDocuments(filter),
  ]);

  const ids = data.map((s) => s._id);
  const [userCounts, equipCounts] = await Promise.all([
    User.aggregate([
      { $match: { sector: { $in: ids } } },
      { $group: { _id: '$sector', count: { $sum: 1 } } },
    ]),
    Equipment.aggregate([
      { $match: { assignedSector: { $in: ids } } },
      { $group: { _id: '$assignedSector', count: { $sum: 1 } } },
    ]),
  ]);

  const userCountMap = Object.fromEntries(userCounts.map((u) => [u._id.toString(), u.count]));
  const equipCountMap = Object.fromEntries(equipCounts.map((e) => [e._id.toString(), e.count]));

  const dataWithCounts = data.map((s) => ({
    ...s.toObject(),
    userCount: userCountMap[s._id.toString()] || 0,
    equipmentCount: equipCountMap[s._id.toString()] || 0,
  }));

  return { data: dataWithCounts, pagination: paginationMeta(total, page, limit) };
}

async function getById(id) {
  const sector = await Sector.findById(id)
    .populate('manager', 'displayName username email');
  if (!sector) {
    const err = new Error('Setor não encontrado');
    err.statusCode = 404;
    throw err;
  }
  return sector;
}

async function create(data, userId, ip) {
  const sector = await Sector.create(data);
  await auditService.log({
    action: 'CREATE',
    entity: 'Sector',
    entityId: sector._id,
    performedBy: userId,
    after: sector.toObject(),
    ip,
  });
  return sector;
}

async function update(id, data, userId, ip) {
  const before = await Sector.findById(id).lean();
  if (!before) {
    const err = new Error('Setor não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const updated = await Sector.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('manager', 'displayName username');

  await auditService.log({
    action: 'UPDATE',
    entity: 'Sector',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

async function remove(id, userId, ip) {
  const sector = await Sector.findById(id).lean();
  if (!sector) {
    const err = new Error('Setor não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const [users, equipments] = await Promise.all([
    User.find({ sector: id }).select('displayName username').lean(),
    Equipment.find({ assignedSector: id }).select('serialNumber patrimonyNumber').populate({ path: 'equipmentModel', select: 'brand model' }).lean(),
  ]);

  if (users.length || equipments.length) {
    const err = new Error('Setor possui usuários ou equipamentos vinculados');
    err.statusCode = 409;
    err.code = 'SECTOR_HAS_DEPENDENCIES';
    err.details = { users, equipments };
    throw err;
  }

  await Sector.findByIdAndDelete(id);
  await auditService.log({
    action: 'DELETE',
    entity: 'Sector',
    entityId: id,
    performedBy: userId,
    before: sector,
    ip,
  });
}

module.exports = { list, getById, create, update, remove };
