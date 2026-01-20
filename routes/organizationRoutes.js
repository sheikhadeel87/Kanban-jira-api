import express from 'express';
import auth from '../middleware/auth.js';
import {
  createOrganization,
  getMyOrganization,
  getOrganizationUsers,
  inviteUserToOrganization,
  deleteOrganization,
} from '../controllers/organizationController.js';

const router = express.Router();

router.post('/', auth, createOrganization);
router.get('/me', auth, getMyOrganization);
router.get('/users', auth, getOrganizationUsers);
router.post('/invite', auth, inviteUserToOrganization);
router.delete('/:id', auth, deleteOrganization);

export default router;
