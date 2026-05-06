const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list, getOne, create, update, remove } = require('../controllers/sectorController');

const router = express.Router();

router.get('/', verifyToken, list);
router.get('/:id', verifyToken, getOne);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
