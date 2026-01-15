import express from 'express';
import auth from '../middleware/auth.js';
import {
  getAllUsers,
  getUserById,
  loginUser,
  createUser,
  updateUserById,
  deleteUserById,
  sendInvite,
  acceptInvitation,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', auth, getAllUsers);
router.get('/accept-invitation', acceptInvitation); // Public endpoint - no auth required
router.post('/login', loginUser);
router.post('/', createUser);
router.post('/invite', auth, sendInvite); // Specific route before parameterized routes
router.get('/:id', auth, getUserById);
router.put('/:id', auth, updateUserById);
router.delete('/:id', auth, deleteUserById);

export default router;