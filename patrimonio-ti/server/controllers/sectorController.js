const { z } = require('zod');
const sectorService = require('../services/sectorService');
const equipmentService = require('../services/equipmentService');
const User = require('../models/User');
const { paginate, paginationMeta } = require('../utils/pagination');
const { success, error } = require('../utils/apiResponse');

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  description: z.string().max(500).optional(),
  manager: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await sectorService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await sectorService.getById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    next(err);
  }
};

const getSectorEquipment = async (req, res, next) => {
  try {
    const { data, pagination } = await equipmentService.listBySector(req.params.id, req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const getSectorUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = { sector: req.params.id };

    if (req.query.isActive !== undefined && req.query.isActive !== '') {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.search) {
      filter.$or = [
        { displayName: { $regex: req.query.search, $options: 'i' } },
        { username: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('username displayName email role isActive lastLogin')
        .sort({ displayName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return success(res, users, 200, paginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await sectorService.create({ ...parsed.data, origin: 'manual' }, req.user.id, req.ip);
    return success(res, data, 201);
  } catch (err) {
    if (err.code === 'SECTOR_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await sectorService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'SECTOR_AD_MANAGED') return error(res, err.message, 403, err.code);
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await sectorService.remove(req.params.id, req.user.id, req.ip);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'SECTOR_HAS_DEPENDENCIES') return error(res, err.message, 409, err.code, err.details);
    next(err);
  }
};

module.exports = { list, getOne, create, update, remove, getSectorEquipment, getSectorUsers };
