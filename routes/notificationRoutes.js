import express from 'express';
import auth from '../middleware/auth.js';
import { sendNotification } from '../controllers/notificationController.js';

const router = express.Router();

router.post('/send', sendNotification);

export default router;