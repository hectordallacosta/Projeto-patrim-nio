const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list } = require('../controllers/auditLogController');

const router = express.Router();

router.get('/', verifyToken, requireAdmin, list);

module.exports = router;
