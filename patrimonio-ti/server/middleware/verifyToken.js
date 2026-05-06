const jwt = require('jsonwebtoken');
const { error } = require('../utils/apiResponse');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return error(res, 'Token não fornecido', 401, 'TOKEN_MISSING');
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return error(res, 'Token inválido ou expirado', 401, 'TOKEN_INVALID');
  }
};

module.exports = verifyToken;
