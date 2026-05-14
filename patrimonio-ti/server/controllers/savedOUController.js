const { z } = require('zod');
const savedOUService = require('../services/savedOUService');
const { success, error } = require('../utils/apiResponse');

const createSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  ouPath: z.string().min(10).trim(),
  description: z.string().max(500).optional(),
});

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await savedOUService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const listAll = async (req, res, next) => {
  try {
    const data = await savedOUService.listAll();
    return success(res, data);
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
    const data = await savedOUService.create(parsed.data, req.user.id);
    return success(res, data, 201);
  } catch (err) {
    if (err.code === 'SAVED_OU_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await savedOUService.update(req.params.id, parsed.data);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'SAVED_OU_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await savedOUService.remove(req.params.id);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

module.exports = { list, listAll, create, update, remove };
