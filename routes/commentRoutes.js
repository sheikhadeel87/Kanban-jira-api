import express from 'express';
import auth from '../middleware/auth.js';
import {
    getCommentsByTask,
    createComment,
    updateComment,
    deleteComment
} from '../controllers/commentController.js';

const router = express.Router();

router.get('/task/:taskId', auth, getCommentsByTask);
router.post('/task/:taskId', auth, createComment);
router.put('/:commentId', auth, updateComment);
router.delete('/:commentId', auth, deleteComment);

export default router;