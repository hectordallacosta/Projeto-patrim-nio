const express = require('express');
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const { list, listAll, create, update, remove } = require('../controllers/savedOUController');

const router = express.Router();

router.get('/all', verifyToken, requireAdmin, listAll);
router.get('/', verifyToken, requireAdmin, list);
router.post('/', verifyToken, requireAdmin, create);
router.put('/:id', verifyToken, requireAdmin, update);
router.delete('/:id', verifyToken, requireAdmin, remove);

module.exports = router;
