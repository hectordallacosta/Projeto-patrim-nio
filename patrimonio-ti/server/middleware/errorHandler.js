const { error } = require('../utils/apiResponse');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    if (err.keyPattern?.brand) {
      return error(res, 'Já existe um modelo com esta combinação de marca, modelo e tipo.', 409, 'EQUIPMENT_MODEL_DUPLICATE');
    }
    const codeMap = {
      serialNumber:    { code: 'SERIAL_NUMBER_DUPLICATE',    message: 'Número de série já cadastrado.' },
      patrimonyNumber: { code: 'PATRIMONY_NUMBER_DUPLICATE', message: 'Número de patrimônio já cadastrado.' },
    };
    const entry = codeMap[field] ?? { code: 'DUPLICATE_KEY', message: `Valor duplicado para o campo: ${field}` };
    return error(res, entry.message, 409, entry.code);
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
