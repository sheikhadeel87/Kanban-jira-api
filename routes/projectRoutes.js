import express from 'express';
import auth from '../middleware/auth.js';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  assignProject,
  addMember,
  removeMember,
  updateMemberRole,
} from '../controllers/projectController.js';

const router = express.Router();

router.get('/', auth, getProjects);
router.get('/:id', auth, getProjectById);
router.post('/', auth, createProject);
router.put('/:id', auth, updateProject);
router.delete('/:id', auth, deleteProject);
router.post('/:id/assign', auth, assignProject);
router.post('/:id/members', auth, addMember);
router.delete('/:id/members/:userId', auth, removeMember);
router.put('/:id/members/:userId/role', auth, updateMemberRole);

export default router;
