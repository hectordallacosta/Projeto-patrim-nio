const User = require('../models/User');
const Equipment = require('../models/Equipment');
const ldapService = require('./ldapService');
const auditService = require('./auditService');
const { paginate, paginationMeta } = require('../utils/pagination');

const POPULATE_SECTOR = { path: 'sector', select: 'name' };

const EQUIPMENT_POPULATE = [
  {
    path: 'equipmentModel',
    select: 'brand model lot type',
    populate: { path: 'type', select: 'name' },
  },
  { path: 'assignedTo', select: 'displayName username' },
  { path: 'assignedSector', select: 'name' },
];

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.noSector === 'true') filter.sector = null;
  else if (query.sector) filter.sector = query.sector;
  if (query.search) {
    filter.$or = [
      { displayName: { $regex: query.search, $options: 'i' } },
      { username: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    User.find(filter).populate(POPULATE_SECTOR).select('-__v -localPassword').sort({ displayName: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const userIds = data.map((u) => u._id);
  const equipCounts = await Equipment.aggregate([
    { $match: { assignedTo: { $in: userIds } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  const equipCountMap = Object.fromEntries(equipCounts.map((e) => [e._id.toString(), e.count]));

  const dataWithCounts = data.map((u) => ({
    ...u.toObject(),
    equipmentCount: equipCountMap[u._id.toString()] || 0,
  }));

  return { data: dataWithCounts, pagination: paginationMeta(total, page, limit) };
}

async function getById(id) {
  const user = await User.findById(id).populate(POPULATE_SECTOR).select('-__v');
  if (!user) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    throw err;
  }
  return user;
}

/**
 * Retorna os equipamentos do usuário + equipamentos do setor do usuário.
 */
async function getEquipment(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const filter = user.sector
    ? { $or: [{ assignedTo: userId }, { assignedSector: user.sector }] }
    : { assignedTo: userId };

  return Equipment.find(filter)
    .populate(EQUIPMENT_POPULATE)
    .sort({ createdAt: -1 });
}

async function update(id, data, userId, ip) {
  const before = await User.findById(id).lean();
  if (!before) {
    const err = new Error('Usuário não encontrado');
    err.statusCode = 404;
    throw err;
  }

  const updated = await User.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate(POPULATE_SECTOR)
    .select('-__v');

  await auditService.log({
    action: 'UPDATE',
    entity: 'User',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

/**
 * Sincroniza os dados de um usuário com o Active Directory.
 * Cria o usuário no MongoDB se ainda não existir.
 */
async function syncFromAD(username, performedBy, ip) {
  const adUser = await ldapService.findUser(username);
  if (!adUser) {
    const err = new Error(`Usuário "${username}" não encontrado no Active Directory`);
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND_AD';
    throw err;
  }

  const before = await User.findOne({ username }).lean();

  const user = await User.findOneAndUpdate(
    { username: adUser.username },
    {
      $set: {
        email: adUser.email || `${adUser.username}@${process.env.LDAP_DOMAIN}`,
        displayName: adUser.displayName,
        adImported: true,
        adDepartment: adUser.adDepartment,
      },
      $setOnInsert: { role: 'user', isActive: true },
    },
    { upsert: true, new: true, runValidators: true }
  ).populate(POPULATE_SECTOR).select('-__v');

  await auditService.log({
    action: before ? 'SYNC_AD' : 'IMPORT_AD',
    entity: 'User',
    entityId: user._id,
    performedBy,
    before,
    after: user.toObject(),
    ip,
  });

  return user;
}

/**
 * Importa múltiplos usuários do AD de uma vez.
 * Retorna resumo: imported, updated, errors.
 */
async function importFromAD(usernames, performedBy, ip) {
  const results = { imported: 0, updated: 0, errors: [] };

  for (const username of usernames) {
    try {
      const before = await User.findOne({ username }).lean();
      await syncFromAD(username, performedBy, ip);
      if (before) results.updated++;
      else results.imported++;
    } catch (err) {
      results.errors.push({ username, error: err.message });
    }
  }

  return results;
}

/**
 * Importa/sincroniza todos os usuários de uma OU do AD.
 * Retorna resumo: total, imported, updated, errors.
 */
async function syncBulkFromAD(ouPath, performedBy, ip) {
  const adUsers = await ldapService.getUsersByOU(ouPath);
  const results = { total: adUsers.length, imported: 0, updated: 0, errors: [] };

  for (const adUser of adUsers) {
    try {
      const before = await User.findOne({ username: adUser.username }).lean();

      await User.findOneAndUpdate(
        { username: adUser.username },
        {
          $set: {
            email: adUser.email || `${adUser.username}@${process.env.LDAP_DOMAIN}`,
            displayName: adUser.displayName,
            adImported: true,
            adDepartment: adUser.adDepartment,
          },
          $setOnInsert: { role: 'user', isActive: true },
        },
        { upsert: true, new: true, runValidators: true }
      );

      if (before) results.updated++;
      else results.imported++;
    } catch (err) {
      results.errors.push({ username: adUser.username, error: err.message });
    }
  }

  return results;
}

async function deactivate(id, performedBy, ip) {
  return update(id, { isActive: false }, performedBy, ip);
}

async function activate(id, performedBy, ip) {
  return update(id, { isActive: true }, performedBy, ip);
}

module.exports = { list, getById, getEquipment, update, syncFromAD, importFromAD, syncBulkFromAD, deactivate, activate };
