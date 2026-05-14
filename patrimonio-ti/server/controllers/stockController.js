const { z } = require('zod');
const stockService = require('../services/stockService');
const { success, error } = require('../utils/apiResponse');

const createSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(500).optional(),
  manager: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await stockService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const listAll = async (req, res, next) => {
  try {
    const data = await stockService.listAll();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await stockService.getById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    next(err);
  }
};

const listEquipment = async (req, res, next) => {
  try {
    const { data, pagination } = await stockService.listEquipment(req.params.id, req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors).flat()[0];
      return error(res, firstError || 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await stockService.create(parsed.data, req.user.id, req.ip);
    return success(res, data, 201);
  } catch (err) {
    if (err.code === 'STOCK_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await stockService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (err.code === 'STOCK_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await stockService.remove(req.params.id, req.user.id, req.ip);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (err.code === 'STOCK_IN_USE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

module.exports = { list, listAll, getOne, listEquipment, create, update, remove };
