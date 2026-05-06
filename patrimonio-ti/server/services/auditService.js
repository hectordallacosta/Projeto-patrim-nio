const AuditLog = require('../models/AuditLog');

async function log({ action, entity, entityId, performedBy, before = null, after = null, ip = null }) {
  await AuditLog.create({ action, entity, entityId, performedBy, before, after, ip });
}

module.exports = { log };
