import express from 'express';
import auth from '../middleware/auth.js';
import {
  getWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addMember,
  removeMember,
  updateMemberRole,
} from '../controllers/workspaceController.js';

const router = express.Router();

router.get('/', auth, getWorkspaces);
router.get('/:id', auth, getWorkspaceById);
router.post('/', auth, createWorkspace);
router.put('/:id', auth, updateWorkspace);
router.delete('/:id', auth, deleteWorkspace);
router.post('/:id/members', auth, addMember);
router.delete('/:id/members/:userId', auth, removeMember);
router.put('/:id/members/:userId/role', auth, updateMemberRole);

export default router;

