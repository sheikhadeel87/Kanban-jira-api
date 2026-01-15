import express from 'express';
import auth from '../middleware/auth.js';
import {
  getBoards,
  getBoardsByWorkspace,
  getBoardById,
  createBoard,
  updateBoard,
  deleteBoard,
  sendBoardInvite,
} from '../controllers/boardController.js';

const router = express.Router();

// Get boards by workspace
router.get('/workspace/:workspaceId', auth, getBoardsByWorkspace);
// Get all boards user has access to
router.get('/', auth, getBoards);
router.get('/:id', auth, getBoardById);
router.post('/', auth, createBoard);
router.put('/:id', auth, updateBoard);
router.delete('/:id', auth, deleteBoard);
// Send board invitation via email
router.post('/:boardId/invite', auth, sendBoardInvite);

export default router;


