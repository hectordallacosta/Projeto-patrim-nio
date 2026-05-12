const { z } = require('zod');
const equipmentService = require('../services/equipmentService');
const { success, error } = require('../utils/apiResponse');

const createSchema = z.object({
  equipmentModel: z.string().min(1, 'Modelo de equipamento obrigatório'),
  serialNumber: z.string().max(100).trim().optional().or(z.literal('')).transform((v) => v || undefined),
  patrimonyNumber: z.string().min(1, 'Número de patrimônio é obrigatório').max(100).trim(),
  notes: z.string().max(1000).optional(),
});

const assignSchema = z.object({
  assignedTo: z.string().optional().nullable(),
  assignedSector: z.string().optional().nullable(),
  note: z.string().max(500).optional(),
});

const statusSchema = z.object({
  status: z.enum(['available', 'assigned', 'maintenance', 'decommissioned']),
});

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await equipmentService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await equipmentService.getById(req.params.id);
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
    const data = await equipmentService.create(parsed.data, req.user.id, req.ip);
    return success(res, data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const assign = async (req, res, next) => {
  try {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.assign(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.statusCode === 400) return error(res, err.message, 400, 'BAD_REQUEST');
    if (err.code === 'EQUIPMENT_UNAVAILABLE') return error(res, err.message, 409, err.code);
    if (err.code === 'USER_INACTIVE') return error(res, err.message, 422, err.code);
    next(err);
  }
};

const unassign = async (req, res, next) => {
  try {
    const note = req.body?.note || '';
    const data = await equipmentService.unassign(req.params.id, note, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.statusCode === 409) return error(res, err.message, 409, 'CONFLICT');
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Status inválido', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.updateStatus(req.params.id, parsed.data.status, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_UNAVAILABLE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await equipmentService.remove(req.params.id, req.user.id, req.ip);
    return success(res, null);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const analyticsBySector = async (req, res, next) => {
  try {
    const data = await equipmentService.getAssetsBySector();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const analyticsByType = async (req, res, next) => {
  try {
    const data = await equipmentService.getAssetsByType();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const analyticsByModelSector = async (req, res, next) => {
  try {
    const data = await equipmentService.getModelsBySector();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const analyticsRecent = async (req, res, next) => {
  try {
    const data = await equipmentService.getRecentAssignments();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getOne, create, update, assign, unassign, changeStatus, remove, analyticsBySector, analyticsByType, analyticsByModelSector, analyticsRecent };
