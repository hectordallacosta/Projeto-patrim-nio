const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const ldapService = require('../services/ldapService');
const User = require('../models/User');
const { success, error } = require('../utils/apiResponse');

const loginSchema = z.object({
  username: z.string().min(1, 'Username obrigatório'),
  password: z.string().min(1, 'Senha obrigatória'),
});

const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const { username, password } = parsed.data;

    let dbUser = null;

    try {
      // Tenta autenticação via LDAP primeiro
      const adUser = await ldapService.authenticateUser(username, password);

      dbUser = await User.findOneAndUpdate(
        { username: adUser.username },
        {
          $set: {
            email: adUser.email || `${adUser.username}@${process.env.LDAP_DOMAIN}`,
            displayName: adUser.displayName,
            adImported: true,
            adDepartment: adUser.adDepartment,
            lastLogin: new Date(),
          },
          $setOnInsert: { role: 'user', isActive: true },
        },
        { upsert: true, new: true, runValidators: true }
      );
    } catch (ldapErr) {
      // Se LDAP falhou, tenta login local (usuários com localPassword definido)
      const localUser = await User.findOne({ username });
      if (localUser?.localPassword) {
        const valid = await bcrypt.compare(password, localUser.localPassword);
        if (!valid) {
          return error(res, 'Credenciais inválidas', 401, 'LDAP_AUTH_FAILED');
        }
        await User.updateOne({ _id: localUser._id }, { lastLogin: new Date() });
        dbUser = localUser;
      } else {
        if (ldapErr.code === 'LDAP_AUTH_FAILED') {
          return error(res, ldapErr.message, 401, 'LDAP_AUTH_FAILED');
        }
        throw ldapErr;
      }
    }

    if (!dbUser.isActive) {
      return error(res, 'Usuário desativado. Contate o administrador.', 403, 'USER_INACTIVE');
    }

    const payload = {
      id: dbUser._id,
      username: dbUser.username,
      role: dbUser.role,
      displayName: dbUser.displayName,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return success(res, { token, user: payload });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-__v')
      .populate('sector', 'name type');

    if (!user) {
      return error(res, 'Usuário não encontrado', 404, 'NOT_FOUND');
    }

    return success(res, user);
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me };
