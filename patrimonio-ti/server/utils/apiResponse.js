const success = (res, data, statusCode = 200, pagination = null) => {
  const body = { success: true, data };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};

const error = (res, message, statusCode = 400, code = null, details = null) => {
  const body = { success: false, message };
  if (code) body.code = code;
  if (details) body.details = details;
  return res.status(statusCode).json(body);
};

module.exports = { success, error };
