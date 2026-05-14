const SavedOU = require('../models/SavedOU');
const { paginate, paginationMeta } = require('../utils/pagination');

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { ouPath: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    SavedOU.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    SavedOU.countDocuments(filter),
  ]);

  return { data, pagination: paginationMeta(total, page, limit) };
}

async function listAll() {
  return SavedOU.find({ isActive: true }).sort({ name: 1 }).lean();
}

async function getById(id) {
  const ou = await SavedOU.findById(id);
  if (!ou) {
    const err = new Error('OU salva não encontrada');
    err.statusCode = 404;
    throw err;
  }
  return ou;
}

async function create(data, userId) {
  const exists = await SavedOU.findOne({ name: data.name }, null, { collation: { locale: 'pt', strength: 2 } });
  if (exists) {
    const err = new Error('Já existe uma OU salva com este nome.');
    err.statusCode = 409;
    err.code = 'SAVED_OU_DUPLICATE';
    throw err;
  }
  return SavedOU.create({ ...data, createdBy: userId });
}

async function update(id, data) {
  const before = await SavedOU.findById(id);
  if (!before) {
    const err = new Error('OU salva não encontrada');
    err.statusCode = 404;
    throw err;
  }

  if (data.name && data.name !== before.name) {
    const exists = await SavedOU.findOne({ name: data.name, _id: { $ne: id } }, null, { collation: { locale: 'pt', strength: 2 } });
    if (exists) {
      const err = new Error('Já existe uma OU salva com este nome.');
      err.statusCode = 409;
      err.code = 'SAVED_OU_DUPLICATE';
      throw err;
    }
  }

  return SavedOU.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function remove(id) {
  const ou = await SavedOU.findById(id);
  if (!ou) {
    const err = new Error('OU salva não encontrada');
    err.statusCode = 404;
    throw err;
  }
  await SavedOU.findByIdAndDelete(id);
}

async function updateSyncResult(ouPath, result) {
  await SavedOU.findOneAndUpdate(
    { ouPath },
    {
      $set: {
        lastSyncAt: new Date(),
        lastSyncResult: {
          total: result.total,
          imported: result.imported,
          updated: result.updated,
          errors: result.errors.length,
        },
      },
    }
  );
}

module.exports = { list, listAll, getById, create, update, remove, updateSyncResult };
