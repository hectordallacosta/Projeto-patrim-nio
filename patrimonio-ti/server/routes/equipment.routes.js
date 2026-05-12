const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const {
  list, getOne, create, update, assign, unassign, changeStatus, remove,
  analyticsBySector, analyticsByType, analyticsByModelSector, analyticsRecent,
} = require('../controllers/equipmentController');

const router = express.Router();

// Analytics — declaradas antes de /:id para evitar conflito de parâmetro
router.get('/analytics/by-sector',       verifyToken, requireAdmin, analyticsBySector);
router.get('/analytics/by-type',         verifyToken, requireAdmin, analyticsByType);
router.get('/analytics/by-model-sector', verifyToken, requireAdmin, analyticsByModelSector);
router.get('/analytics/recent',          verifyToken, requireAdmin, analyticsRecent);

router.get('/', verifyToken, list);
router.get('/:id', verifyToken, getOne);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.patch('/:id/assign', verifyToken, requireAdmin, assign);
router.patch('/:id/unassign', verifyToken, requireAdmin, unassign);
router.patch('/:id/status', verifyToken, requireAdmin, changeStatus);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
