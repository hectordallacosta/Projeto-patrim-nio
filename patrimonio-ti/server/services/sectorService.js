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
    // Conta equipamentos fora de estoque: diretos do setor + atribuídos a usuários do setor
    Equipment.aggregate([
      { $match: { status: { $ne: 'in_stock' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $addFields: {
          effectiveSector: {
            $cond: {
              if: { $ne: ['$assignedSector', null] },
              then: '$assignedSector',
              else: { $arrayElemAt: ['$user.sector', 0] },
            },
          },
        },
      },
      { $match: { effectiveSector: { $in: ids } } },
      { $group: { _id: '$effectiveSector', count: { $sum: 1 } } },
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
    .populate('manager', '_id displayName username');
  if (!sector) {
    const err = new Error('Setor não encontrado');
    err.statusCode = 404;
    err.code = 'SECTOR_NOT_FOUND';
    throw err;
  }

  const sectorId = sector._id;
  const usersInSector = await User.find({ sector: sectorId }).select('_id').lean();
  const userIds = usersInSector.map((u) => u._id);

  const [userCount, equipmentCount] = await Promise.all([
    User.countDocuments({ sector: sectorId }),
    Equipment.countDocuments({
      status: { $ne: 'in_stock' },
      $or: [
        { assignedSector: sectorId },
        { assignedTo: { $in: userIds } },
      ],
    }),
  ]);

  return { sector, userCount, equipmentCount };
}

async function create(data, userId, ip) {
  const exists = await Sector.findOne({ name: data.name }, null, { collation: { locale: 'pt', strength: 2 } });
  if (exists) {
    const err = new Error('Já existe um setor com este nome.');
    err.statusCode = 409;
    err.code = 'SECTOR_DUPLICATE';
    throw err;
  }
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

  if (before.origin === 'ad') {
    const err = new Error('Setores criados pelo Active Directory não podem ser editados manualmente.');
    err.statusCode = 403;
    err.code = 'SECTOR_AD_MANAGED';
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
