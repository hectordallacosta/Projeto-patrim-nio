const Stock = require('../models/Stock');
const Equipment = require('../models/Equipment');
const auditService = require('./auditService');
const { paginate, paginationMeta } = require('../utils/pagination');

const POPULATE = [
  { path: 'manager', select: 'displayName username' },
];

async function list(query) {
  const { page, limit, skip } = paginate(query);
  const filter = {};

  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Stock.find(filter).populate(POPULATE).sort({ name: 1 }).skip(skip).limit(limit),
    Stock.countDocuments(filter),
  ]);

  const stockIds = data.map((s) => s._id);
  const counts = await Equipment.aggregate([
    { $match: { stock: { $in: stockIds }, status: 'in_stock' } },
    { $group: { _id: '$stock', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.count]));

  const dataWithCounts = data.map((s) => ({
    ...s.toObject(),
    equipmentCount: countMap[s._id.toString()] || 0,
  }));

  return { data: dataWithCounts, pagination: paginationMeta(total, page, limit) };
}

async function listAll() {
  return Stock.find({ isActive: true }).populate(POPULATE).sort({ name: 1 }).lean();
}

async function getById(id) {
  const stock = await Stock.findById(id).populate(POPULATE);
  if (!stock) {
    const err = new Error('Estoque não encontrado');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }
  return stock;
}

async function listEquipment(stockId, query) {
  const { page, limit, skip } = paginate(query);
  const filter = { stock: stockId, status: 'in_stock' };

  if (query.search) {
    filter.$or = [
      { patrimonyNumber: { $regex: query.search, $options: 'i' } },
      { serialNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const POPULATE_FIELDS = [
    {
      path: 'equipmentModel',
      select: 'brand model lot type',
      populate: { path: 'type', select: 'name' },
    },
  ];

  const [data, total] = await Promise.all([
    Equipment.find(filter).populate(POPULATE_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Equipment.countDocuments(filter),
  ]);

  return { data, pagination: paginationMeta(total, page, limit) };
}

async function create(data, userId, ip) {
  const exists = await Stock.findOne({ name: data.name }, null, { collation: { locale: 'pt', strength: 2 } });
  if (exists) {
    const err = new Error('Já existe um estoque com este nome.');
    err.statusCode = 409;
    err.code = 'STOCK_DUPLICATE';
    throw err;
  }

  const stock = await Stock.create(data);
  await auditService.log({
    action: 'CREATE',
    entity: 'Stock',
    entityId: stock._id,
    performedBy: userId,
    after: stock.toObject(),
    ip,
  });
  return stock.populate(POPULATE);
}

async function update(id, data, userId, ip) {
  const before = await Stock.findById(id).lean();
  if (!before) {
    const err = new Error('Estoque não encontrado');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }

  if (data.name && data.name !== before.name) {
    const exists = await Stock.findOne({ name: data.name, _id: { $ne: id } }, null, { collation: { locale: 'pt', strength: 2 } });
    if (exists) {
      const err = new Error('Já existe um estoque com este nome.');
      err.statusCode = 409;
      err.code = 'STOCK_DUPLICATE';
      throw err;
    }
  }

  const updated = await Stock.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate(POPULATE);
  await auditService.log({
    action: 'UPDATE',
    entity: 'Stock',
    entityId: id,
    performedBy: userId,
    before,
    after: updated.toObject(),
    ip,
  });
  return updated;
}

async function remove(id, userId, ip) {
  const count = await Equipment.countDocuments({ stock: id });
  if (count > 0) {
    const err = new Error(`Não é possível excluir: ${count} equipamento(s) vinculado(s) a este estoque.`);
    err.statusCode = 409;
    err.code = 'STOCK_IN_USE';
    throw err;
  }

  const stock = await Stock.findById(id).lean();
  if (!stock) {
    const err = new Error('Estoque não encontrado');
    err.statusCode = 404;
    err.code = 'STOCK_NOT_FOUND';
    throw err;
  }

  await Stock.findByIdAndDelete(id);
  await auditService.log({
    action: 'DELETE',
    entity: 'Stock',
    entityId: id,
    performedBy: userId,
    before: stock,
    ip,
  });
}

module.exports = { list, listAll, getById, listEquipment, create, update, remove };
