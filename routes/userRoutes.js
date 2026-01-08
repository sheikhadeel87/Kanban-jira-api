import express from 'express';
import {
  getAllUsers,
  getUserById,
  loginUser,
  createUser,
  updateUserById,
  deleteUserById,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/login', loginUser);
router.post('/', createUser);
router.put('/:id', updateUserById);
router.delete('/:id', deleteUserById);

export default router;