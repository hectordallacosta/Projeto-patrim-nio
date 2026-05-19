const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list, getOne, create, update, remove, getSectorEquipment, getSectorUsers } = require('../controllers/sectorController');

const router = express.Router();

router.get('/', verifyToken, list);
// Subrotas antes de /:id para evitar conflito de parâmetro
router.get('/:id/equipment', verifyToken, requireAdmin, getSectorEquipment);
router.get('/:id/users', verifyToken, requireAdmin, getSectorUsers);
router.get('/:id', verifyToken, getOne);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
