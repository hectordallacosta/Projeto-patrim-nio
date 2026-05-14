const { z } = require('zod');
const equipmentService = require('../services/equipmentService');
const { success, error } = require('../utils/apiResponse');

const createSchema = z.object({
  equipmentModel: z.string().min(1, 'Modelo de equipamento obrigatório'),
  stock: z.string().min(1, 'Estoque é obrigatório'),
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
  status: z.enum(['maintenance', 'decommissioned']),
});

const retrieveSchema = z.object({
  sectorId: z.string().min(1, 'Setor é obrigatório'),
});

const unassignSchema = z.object({
  stockId: z.string().min(1, 'Estoque de destino é obrigatório'),
  note: z.string().max(500).optional(),
});

const sendToStockSchema = z.object({
  stockId: z.string().min(1, 'Estoque de destino é obrigatório'),
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
    const parsed = unassignSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Estoque de destino é obrigatório', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.unassign(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (err.statusCode === 409) return error(res, err.message, 409, err.code || 'CONFLICT');
    next(err);
  }
};

const sendToStock = async (req, res, next) => {
  try {
    const parsed = sendToStockSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Estoque de destino é obrigatório', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.sendToStock(req.params.id, parsed.data.stockId, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_ALREADY_IN_STOCK') return error(res, err.message, 422, err.code);
    if (err.code === 'EQUIPMENT_UNAVAILABLE') return error(res, err.message, 409, err.code);
    next(err);
  }
};

const changeStatus = async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Este status é gerenciado automaticamente pelo sistema.', 422, 'STATUS_NOT_ALLOWED', parsed.error.flatten());
    }
    const data = await equipmentService.updateStatus(req.params.id, parsed.data.status, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    if (err.code === 'STATUS_NOT_ALLOWED') return error(res, err.message, 422, err.code);
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

const retrieveEquipment = async (req, res, next) => {
  try {
    const parsed = retrieveSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Setor é obrigatório', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await equipmentService.retrieve(req.params.id, parsed.data.sectorId, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (err.code === 'EQUIPMENT_NOT_IN_STOCK') return error(res, err.message, 422, err.code);
    next(err);
  }
};

const analyticsInStock = async (req, res, next) => {
  try {
    const count = await equipmentService.getInStockCount();
    return success(res, { count });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getOne, create, update, assign, unassign, sendToStock, changeStatus, retrieveEquipment, remove, analyticsBySector, analyticsByType, analyticsByModelSector, analyticsRecent, analyticsInStock };
