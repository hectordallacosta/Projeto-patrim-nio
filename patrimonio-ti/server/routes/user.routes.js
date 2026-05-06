const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const {
  list, getOne, getMyEquipment, getUserEquipment,
  update, syncFromAD, searchAD, importFromAD, syncBulkFromAD, deactivate, activate,
} = require('../controllers/userController');

const router = express.Router();

// Rotas fixas — devem vir antes de /:id para não colidir
router.get('/me/equipment', verifyToken, getMyEquipment);
router.get('/search-ad', verifyToken, requireAdmin, searchAD);

router.get('/', verifyToken, requireAdmin, list);
router.get('/:id', verifyToken, getOne);
router.get('/:id/equipment', verifyToken, requireAdmin, getUserEquipment);
router.put('/:id', verifyToken, requireAdmin, update);
router.post('/sync/:username', verifyToken, requireAdmin, syncFromAD);
router.post('/import-ad', verifyToken, requireAdmin, importFromAD);
router.post('/sync-ad-bulk', verifyToken, requireAdmin, syncBulkFromAD);
router.patch('/:id/deactivate', verifyToken, requireAdmin, deactivate);
router.patch('/:id/activate', verifyToken, requireAdmin, activate);

module.exports = router;
