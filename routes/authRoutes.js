import express from 'express';
import auth from '../middleware/auth.js';
import { register, login, getMe } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);

export default router;

