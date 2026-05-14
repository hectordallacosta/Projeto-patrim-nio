const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list, listAll, getOne, listEquipment, create, update, remove } = require('../controllers/stockController');

const router = express.Router();

router.get('/all', verifyToken, requireAdmin, listAll);
router.get('/', verifyToken, requireAdmin, list);
router.get('/:id/equipment', verifyToken, requireAdmin, listEquipment);
router.get('/:id', verifyToken, requireAdmin, getOne);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
