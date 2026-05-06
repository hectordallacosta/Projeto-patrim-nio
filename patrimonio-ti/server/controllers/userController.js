const { z } = require('zod');
const userService = require('../services/userService');
const ldapService = require('../services/ldapService');
const { success, error } = require('../utils/apiResponse');

const updateSchema = z.object({
  role: z.enum(['admin', 'user']).optional(),
  sector: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  displayName: z.string().min(1).max(150).optional(),
});

const isLdapConnError = (err) =>
  err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
  err.code === 'ETIMEDOUT' || err.message?.includes('certificate') ||
  err.message?.includes('LDAP') || err.name === 'LdapError';

const list = async (req, res, next) => {
  try {
    const { data, pagination } = await userService.list(req.query);
    return success(res, data, 200, pagination);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return error(res, 'Acesso negado', 403, 'FORBIDDEN');
    }
    const data = await userService.getById(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const getMyEquipment = async (req, res, next) => {
  try {
    const data = await userService.getEquipment(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getUserEquipment = async (req, res, next) => {
  try {
    const data = await userService.getEquipment(req.params.id);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await userService.update(req.params.id, parsed.data, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const syncFromAD = async (req, res, next) => {
  try {
    const { username } = req.params;
    const data = await userService.syncFromAD(username, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, err.code || 'NOT_FOUND');
    if (isLdapConnError(err)) {
      return error(res, 'Serviço de diretório (AD/LDAP) indisponível. Verifique a configuração no arquivo .env do servidor.', 503, 'LDAP_UNAVAILABLE');
    }
    next(err);
  }
};

/**
 * Busca usuários no Active Directory por nome ou username (busca parcial).
 * GET /api/users/search-ad?q=query
 */
const searchAD = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return success(res, []);
    const data = await ldapService.searchUsers(q);
    return success(res, data);
  } catch (err) {
    if (isLdapConnError(err)) {
      return error(res, 'Serviço de diretório (AD/LDAP) indisponível.', 503, 'LDAP_UNAVAILABLE');
    }
    next(err);
  }
};

/**
 * Importa múltiplos usuários do AD para o MongoDB.
 * POST /api/users/import-ad  { usernames: ['joao.silva', 'maria.souza'] }
 */
const importFromAD = async (req, res, next) => {
  try {
    const parsed = z.object({
      usernames: z.array(z.string().min(1)).min(1, 'Selecione ao menos um usuário'),
    }).safeParse(req.body);

    if (!parsed.success) {
      return error(res, parsed.error.flatten().fieldErrors.usernames?.[0] || 'Dados inválidos', 422, 'VALIDATION_ERROR');
    }

    const data = await userService.importFromAD(parsed.data.usernames, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (isLdapConnError(err)) {
      return error(res, 'Serviço de diretório (AD/LDAP) indisponível.', 503, 'LDAP_UNAVAILABLE');
    }
    next(err);
  }
};

/**
 * Sincroniza todos os usuários de uma OU do AD com o MongoDB.
 * POST /api/users/sync-ad-bulk  { ouPath: "OU=..." }
 */
const syncBulkFromAD = async (req, res, next) => {
  try {
    const parsed = z.object({
      ouPath: z.string().min(3, 'Caminho da OU inválido'),
    }).safeParse(req.body);

    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const data = await userService.syncBulkFromAD(parsed.data.ouPath, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 400) return error(res, err.message, 400, 'BAD_REQUEST');
    if (isLdapConnError(err)) {
      return error(res, 'Serviço de diretório (AD/LDAP) indisponível.', 503, 'LDAP_UNAVAILABLE');
    }
    next(err);
  }
};

const deactivate = async (req, res, next) => {
  try {
    const data = await userService.deactivate(req.params.id, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

const activate = async (req, res, next) => {
  try {
    const data = await userService.activate(req.params.id, req.user.id, req.ip);
    return success(res, data);
  } catch (err) {
    if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

module.exports = { list, getOne, getMyEquipment, getUserEquipment, update, syncFromAD, searchAD, importFromAD, syncBulkFromAD, deactivate, activate };
