'use strict';
const express = require('express');
const { stats } = require('../controllers/dashboardController');

const router = express.Router();
router.get('/stats', stats);

module.exports = router;
