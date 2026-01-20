import Organization from '../models/organization.model.js';
import User from '../models/user.model.js';
import crypto from 'crypto';
import { sendOrganizationInvitation } from '../utils/emailService.js';
import { isOwner, isAdminOrOwner, canInviteUser, canDeleteOrg } from '../utils/permissions.js';

/**
 * Create organization (first user becomes owner)
 */
export const createOrganization = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const user = await User.findById(req.user.id);
    if (user.organization) {
      return res.status(400).json({ 
        msg: 'User already belongs to an organization' 
      });
    }

    const organization = new Organization({
      name,
      description,
      owner: req.user.id,
    });

    await organization.save();

    // Update user to belong to this organization and set as owner
    user.organization = organization._id;
    user.role = 'owner';
    await user.save();

    await organization.populate('owner', 'name email');

    res.json(organization);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Get user's organization
 */
export const getMyOrganization = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    
    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const organization = await Organization.findById(organizationId)
      .populate('owner', 'name email');

    if (!organization) {
      return res.status(404).json({ msg: 'Organization not found' });
    }

    res.json(organization);
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Get organization members (all users in the organization)
 */
export const getOrganizationUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
        return res.status(404).json({ msg: 'User does not belong to an organization' });
      }
  
      // Get organization ID (handle both populated and non-populated cases)
      const organizationId = user.organization._id || user.organization;
      const users = await User.find({ organization: organizationId })
        .select('-password')
        .sort({ createdAt: 1 });
  
      res.json(users);
    } catch (err) {
      console.error('Get organization users error:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
};

/**
 * Invite user to organization (admin/owner only)
 */
export const inviteUserToOrganization = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('Invite request received:', { email, userId: req.user.id });
    
    if (!email || !email.includes('@')) {
      console.log('Invalid email format');
      return res.status(400).json({ msg: 'Valid email is required' });
    }

    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      console.log('User not found or no organization');
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const organization = await Organization.findById(organizationId);
    
    if (!organization) {
      console.log('Organization not found:', organizationId);
      return res.status(404).json({ msg: 'Organization not found' });
    }

    if (!canInviteUser(user, organization)) {
      console.log('User not authorized to invite:', { userRole: user.role, isOwner: organization.owner?.toString() === user._id.toString() });
      return res.status(403).json({ msg: 'Not authorized to invite users' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Normalized email:', normalizedEmail);

    // Check if user already in org
    const existingUser = await User.findOne({ 
      email: normalizedEmail,
      organization: organization._id 
    });
    
    if (existingUser) {
      console.log('User already in organization:', existingUser._id);
      return res.status(400).json({ msg: 'User already in organization' });
    }

    // Check if there's already an invitation (pending, expired, or declined)
    const OrganizationInvitation = (await import('../models/organizationInvitation.model.js')).default;
    let existingInvitation = await OrganizationInvitation.findOne({
      organization: organization._id,
      invitedEmail: normalizedEmail,
    });

    console.log('Existing invitation found:', existingInvitation ? {
      status: existingInvitation.status,
      expiresAt: existingInvitation.tokenExpiresAt,
      isExpired: existingInvitation.tokenExpiresAt < new Date()
    } : 'none');

    // If there's a pending invitation that hasn't expired, don't create a new one
    if (existingInvitation && existingInvitation.status === 'invited' && existingInvitation.tokenExpiresAt > new Date()) {
      console.log('Pending invitation exists and not expired');
      return res.status(400).json({ 
        msg: 'Invitation already sent to this email. Please wait for it to be accepted or expired.' 
      });
    }

    // If there's an old invitation (expired or declined), update it to create a new one
    let invitation;
    if (existingInvitation) {
      console.log('Updating existing invitation');
      try {
        // Update existing invitation with new token and reset status
        existingInvitation.status = 'invited';
        existingInvitation.invitedBy = req.user.id;
        existingInvitation.invitationToken = crypto.randomBytes(32).toString('hex');
        existingInvitation.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        existingInvitation.memberId = null;
        await existingInvitation.save();
        invitation = existingInvitation;
        console.log('Invitation updated successfully');
      } catch (updateErr) {
        console.error('Error updating invitation:', updateErr);
        throw updateErr;
      }
    } else {
      console.log('Creating new invitation');
      // Create new invitation
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          invitation = new OrganizationInvitation({
            organization: organization._id,
            invitedBy: req.user.id,
            invitedEmail: normalizedEmail,
          });

          await invitation.save();
          console.log('Invitation created successfully');
          break; // Success, exit loop
        } catch (saveErr) {
          console.error('Error saving invitation (attempt ' + (retries + 1) + '):', saveErr);
          if (saveErr.code === 11000 && retries < maxRetries - 1) {
            // Duplicate key error (token collision), retry
            console.log('Duplicate key error, retrying...');
            retries++;
            continue;
          }
          throw saveErr; // Re-throw if not a duplicate key error or max retries reached
        }
      }
    }

    // Send invitation email
    const inviterName = user.name || 'Admin';
    const emailResult = await sendOrganizationInvitation(
      normalizedEmail,
      inviterName,
      organization.name,
      invitation.invitationToken
    );

    if (!emailResult.success) {
      console.warn('Failed to send invitation email:', emailResult.error || emailResult.message);
      // Still return success since invitation was created, but log the email failure
    }

    res.json({ 
      msg: 'Invitation sent successfully',
      invitation: {
        _id: invitation._id,
        invitedEmail: invitation.invitedEmail,
        status: invitation.status,
        tokenExpiresAt: invitation.tokenExpiresAt,
      }
    });
  } catch (err) {
    console.error('Invite user error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: err.stack
    });
    
    // If it's a validation error, return 400
    if (err.name === 'ValidationError' || err.code === 11000) {
      return res.status(400).json({ 
        msg: err.message || 'Invalid invitation data',
        error: err.message 
      });
    }
    
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Delete organization (owner only)
 */
export const deleteOrganization = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    
    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    if (!canDeleteOrg(user, organization)) {
      return res.status(403).json({ msg: 'Only organization owner can delete' });
    }

    // TODO: Delete all related data (projects, boards, tasks)
    // This should be handled with cascade deletes or manual cleanup

    await Organization.findByIdAndDelete(organization._id);
    res.json({ msg: 'Organization deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};
