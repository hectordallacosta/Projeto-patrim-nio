const { error } = require('../utils/apiResponse');

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return error(res, 'Acesso restrito a administradores', 403, 'FORBIDDEN');
  }
  next();
};

module.exports = requireAdmin;
