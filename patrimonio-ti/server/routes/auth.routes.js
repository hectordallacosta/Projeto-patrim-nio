const express = require('express');
const { login, me } = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.post('/login', login);
router.get('/me', verifyToken, me);

module.exports = router;
