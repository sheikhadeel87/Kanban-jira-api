import express from 'express';
import auth from '../middleware/auth.js';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, createNotification } from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.post('/', auth, createNotification);
router.patch('/:id/read', auth, markAsRead);
router.patch('/read-all', auth, markAllAsRead);

export default router;