const { z } = require('zod');
const equipmentTypeService = require('../services/equipmentTypeService');
const { success, error } = require('../utils/apiResponse');

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const list = async (req, res, next) => {
  try {
    const data = await equipmentTypeService.list();
    return success(res, data);
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
    const data = await equipmentTypeService.create(parsed.data, req.user.id, req.ip);
    return success(res, data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentTypeService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await equipmentTypeService.remove(req.params.id, req.user.id, req.ip);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_TYPE_IN_USE') return error(res, err.message, 409, err.code, err.details);
    next(err);
  }
};

module.exports = { list, create, update, remove };
