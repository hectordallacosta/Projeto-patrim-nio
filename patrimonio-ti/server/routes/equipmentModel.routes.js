const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list, listAll, getOne, create, update, remove } = require('../controllers/equipmentModelController');

const router = express.Router();

// /all deve vir antes de /:id para não colidir
router.get('/all', verifyToken, listAll);
router.get('/', verifyToken, list);
router.get('/:id', verifyToken, getOne);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
