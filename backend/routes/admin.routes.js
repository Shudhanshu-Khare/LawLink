// backend/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getPendingUsers, getAllLawyers, getAllClients,
  verifyUser, blockUser, unblockUser, deleteUser
} = require('../controllers/admin.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/pending', getPendingUsers);
router.get('/lawyers', getAllLawyers);
router.get('/clients', getAllClients);
router.put('/verify/:id', verifyUser);
router.put('/block/:id', blockUser);
router.put('/unblock/:id', unblockUser);
router.delete('/users/:id', deleteUser);

module.exports = router;
