const { z } = require('zod');
const equipmentModelService = require('../services/equipmentModelService');
const { success, error } = require('../utils/apiResponse');

const dateField = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00.000Z`);
    return v;
  },
  z.date().nullable().optional()
);

const createSchema = z.object({
  type: z.string().min(1, 'Tipo de equipamento obrigatório'),
  brand: z.string().min(1, 'Marca obrigatória').max(100),
  model: z.string().min(1, 'Modelo obrigatório').max(100),
  lot: z.preprocess((v) => (v === '' ? null : v), z.string().max(200).nullable().optional()),
  warrantyExpiry: dateField,
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await equipmentModelService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const listAll = async (req, res, next) => {
  try {
    const data = await equipmentModelService.listAll();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await equipmentModelService.getById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
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
    const data = await equipmentModelService.create(parsed.data, req.user.id, req.ip);
    return success(res, data, 201);
  } catch (err) {
    if (err.code === 'EQUIPMENT_MODEL_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentModelService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_MODEL_DUPLICATE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await equipmentModelService.remove(req.params.id, req.user.id, req.ip);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_MODEL_IN_USE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

module.exports = { list, listAll, getOne, create, update, remove };
