const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/apiResponse');
const { paginate, paginationMeta } = require('../utils/pagination');

const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = paginate(req.query);
    const filter = {};

    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.performedBy) filter.performedBy = req.query.performedBy;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [data, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('performedBy', 'displayName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    return success(res, data, 200, paginationMeta(total, page, limit));
  } catch (err) {
    next(err);
  }
};

module.exports = { list };
