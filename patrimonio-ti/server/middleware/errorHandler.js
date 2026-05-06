const { error } = require('../utils/apiResponse');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return error(res, `Valor duplicado para o campo: ${field}`, 409, 'SERIAL_NUMBER_DUPLICATE');
  }

  if (err.name === 'ValidationError') {
    return error(res, 'Dados inválidos', 422, 'VALIDATION_ERROR', err.errors);
  }

  if (err.name === 'CastError') {
    return error(res, 'ID inválido', 400, 'INVALID_ID');
  }

  return error(res, err.message || 'Erro interno do servidor', err.statusCode || 500);
};

module.exports = errorHandler;
