import express from 'express';
import auth from '../middleware/auth.js';
import {
  createOrganization,
  getMyOrganization,
  getOrganizationUsers,
  inviteUserToOrganization,
  deleteOrganization,
  removeMemberFromOrganization,
  syncUserRoleFromInvitation,
  updateMember,
} from '../controllers/organizationController.js';

const router = express.Router();

router.post('/', auth, createOrganization);
router.get('/me', auth, getMyOrganization);
router.get('/users', auth, getOrganizationUsers);
router.post('/invite', auth, inviteUserToOrganization);
router.post('/members/:userId/sync-role', auth, syncUserRoleFromInvitation);
router.put('/:id/members/:userId', auth, updateMember);
router.delete('/:id', auth, deleteOrganization);
router.delete('/:id/members/:userId', auth, removeMemberFromOrganization);

export default router;
