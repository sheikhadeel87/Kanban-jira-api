import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import { sendUserInvitation } from '../utils/emailService.js';

dotenv.config();

export const getAllUsers = async (req, res) => {
  try {
    // Get current user ID from request (set by auth middleware)
    // The auth middleware sets req.user as a User document with _id
    if (!req.user || !req.user._id) {
      console.log('No user found in request - req.user:', req.user);
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const currentUserId = req.user._id;
    const currentUserIdStr = currentUserId.toString();
    console.log(`🔍 Getting team members for authenticated user ID: ${currentUserIdStr}`);

    // Import Team model (this is the "teams" table with inviting_id and member_id)
    const Team = (await import('../models/team.model.js')).default;
    
    // CRITICAL: Get ONLY team records where inviting_id exactly matches current user's ID
    // NO ADMIN EXCEPTIONS - even admins only see members they invited
    // This query filters at the database level for maximum security
    const teamRecords = await Team.find({
      inviting_id: currentUserId, // MUST MATCH: Only records where inviting_id = current user's ID
      member_id: { $ne: null }, // Only show members who have registered (member_id is set)
      status: { $in: ['invited', 'accepted'] }, // Only active invitations
    })
    .populate('member_id', 'name email role _id') // Join with User table to get member details
    .populate('inviting_id', 'name email'); // Join with User table to verify inviter
    
    console.log(`📊 Query result: Found ${teamRecords.length} team records where inviting_id = ${currentUserIdStr}`);
    
    // Debug: Verify each record's inviting_id matches (double-check database query worked)
    teamRecords.forEach((record, index) => {
      const recordInvitingId = record.inviting_id?._id?.toString() || record.inviting_id?.toString() || 'unknown';
      const recordMemberId = record.member_id?._id?.toString() || record.member_id?.toString() || 'unknown';
      const matches = recordInvitingId === currentUserIdStr;
      
      console.log(`  Record ${index + 1}: inviting_id=${recordInvitingId}, member_id=${recordMemberId}, matches=${matches}`);
      
      if (!matches) {
        console.error(`  ❌ MISMATCH: Record ${record._id} has inviting_id ${recordInvitingId} but current user is ${currentUserIdStr}`);
      }
    });
    
    // If no team records found for this user, return empty array
    if (!teamRecords || teamRecords.length === 0) {
      console.log(`✅ No team members found for user ${currentUserIdStr} - returning empty array`);
      return res.status(200).json([]);
    }
    
    // Extract users from team records (data comes from Team table via populate/join)
    // CRITICAL: Additional client-side filter to ensure ONLY records where inviting_id matches
    // Check both the raw document field and populated field
    const users = teamRecords
      .filter(team => {
        // Must have member_id
        if (!team.member_id || !team.member_id._id) {
          console.warn(`⚠️ Skipping record ${team._id}: no member_id`);
          return false;
        }
        
        // CRITICAL CHECK: Verify inviting_id exactly matches current user
        // Check the raw document field first (before populate)
        const rawInvitingId = team._doc?.inviting_id?.toString() || team.inviting_id?.toString();
        
        // Then check populated field
        let populatedInvitingId;
        if (team.inviting_id && typeof team.inviting_id === 'object' && team.inviting_id._id) {
          populatedInvitingId = team.inviting_id._id.toString();
        } else if (team.inviting_id && typeof team.inviting_id === 'object') {
          populatedInvitingId = team.inviting_id.toString();
        } else {
          populatedInvitingId = team.inviting_id?.toString();
        }
        
        // Use raw document field if available, otherwise use populated
        const teamInvitingId = rawInvitingId || populatedInvitingId;
        const matches = teamInvitingId === currentUserIdStr;
        
        if (!matches) {
          console.error(`❌ SECURITY: Filtering out record ${team._id}`);
          console.error(`   Raw inviting_id: ${rawInvitingId}`);
          console.error(`   Populated inviting_id: ${populatedInvitingId}`);
          console.error(`   Current user ID: ${currentUserIdStr}`);
          return false; // STRICT: Only include if inviting_id matches
        }
        
        return true; // Only include if inviting_id matches current user
      })
      .map(team => ({
        _id: team.member_id._id,
        name: team.member_id.name,
        email: team.member_id.email,
        role: team.member_id.role,
        // Additional info from team record
        invitedAt: team.invitedAt,
        acceptedAt: team.acceptedAt,
        status: team.status,
      }));
    
    console.log(`✅ FINAL: Returning ${users.length} team members for user ${currentUserIdStr} (filtered by inviting_id)`);
    
    // Return users from Team table (ONLY those where inviting_id = current user's ID)
    // NO ADMIN EXCEPTIONS - everyone only sees their own invited members
    return res.status(200).json(users);
  } catch (err) {
    console.error('❌ Error in getAllUsers (querying Team table):', err);
    // Return empty array on error - never query Users table directly
    return res.status(200).json([]);
  }
};

export const getUserById = async (req, res) => {
  try {
    const id = req.params.id;
    const found = await User.findById(id);
    if (!found) {
      return res.status(400).json({ msg: 'user not found' });
    }
    return res.status(200).json({ Found: found });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: err });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userExists = await User.findOne({ email });

    if (!userExists) return res.status(400).json({ msg: 'Email not Registered' });

    if (await bcrypt.compare(password, userExists.password)) {
      const payload = { _id: userExists._id };
      const expireTime = process.env.JWT_EXPIRE_TIME;
      const tokenHeader = process.env.JWT_TOKEN_HEADER;
      const secretKey = process.env.JWT_SECRET_KEY;
      const token = await jwt.sign(payload, secretKey, { expiresIn: Number(expireTime) });
      res.header(tokenHeader, token);
      return res.status(200).json({ success: 'Login Successful', token });
    }
    return res.status(400).json({ msg: 'Invalid Password' });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: err.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, createdAt, role } = req.body;
    const hashedPass = await bcrypt.hash(password, 10);
    const added = await User.create({
      name,
      email,
      password: hashedPass,
      role,
      createdAt,
    });
    if (!added) {
      return res.status(400).json({ msg: 'error adding user' });
    }
    const payload = { _id: added._id };
    const expireTime = process.env.JWT_EXPIRE_TIME;
    const tokenHeader = process.env.JWT_TOKEN_HEADER;
    const secretKey = process.env.JWT_SECRET_KEY;
    const token = await jwt.sign(payload, secretKey, { expiresIn: Number(expireTime) });
    res.header(tokenHeader, token);
    return res.status(201).json({
      success: true,
      message: 'User successfully created.',
      data: added,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: err });
  }
};

export const updateUserById = async (req, res) => {
  try {
    // Check if user is admin
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
    }

    const id = req.params.id;
    
    const { name, email, role } = req.body;
    console.log("BODY:", req.body);
    const updated = await User.findByIdAndUpdate(
      id,
      { name, email, role },
      { new: true }
    );
    if (!updated) {
      return res.status(400).json({ msg: 'error updating user' });
    }
    return res.status(200).json({ Updated: updated });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: err });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(403).json({ msg: 'Access denied. User not found.' });
    }

    // Check if user is admin OR workspace creator
    const isAdmin = currentUser.role === 'admin';
    
    // If not admin, check if user is a workspace creator
    let isWorkspaceCreator = false;
    if (!isAdmin) {
      const Workspace = (await import('../models/workspace.model.js')).default;
      const workspaces = await Workspace.find({ createdBy: req.user.id });
      isWorkspaceCreator = workspaces.length > 0;
    }

    // Only allow delete if user is admin OR workspace creator
    if (!isAdmin && !isWorkspaceCreator) {
      return res.status(403).json({ 
        msg: 'Access denied. Only workspace creators can delete users.' 
      });
    }

    const id = req.params.id;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(400).json({ msg: 'error deleting user' });
    }
    return res.status(200).json({ Deleted: deleted });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: err });
  }
};

export const sendInvite = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('sendInvite called with email:', email, 'by user:', req.user.id);

    if (!email || !email.includes('@')) {
      return res.status(400).json({ msg: 'Valid email is required' });
    }

    // Import Team model (teams table with inviting_id and member_id)
    const Team = (await import('../models/team.model.js')).default;
    console.log('Team model imported successfully');

    const normalizedEmail = email.toLowerCase().trim();

    // Check if invitation already exists (for both existing and new users)
    const existingInvitation = await Team.findOne({
      inviting_id: req.user.id,
      invitedEmail: normalizedEmail,
      status: { $in: ['invited', 'accepted'] },
    });

    if (existingInvitation) {
      if (existingInvitation.status === 'accepted') {
        return res.status(400).json({ msg: 'User is already in your team' });
      }
      // If invitation is still pending, resend it
      console.log('Invitation already exists but pending - resending email');
    } else {
      // Check if user exists (for member_id)
      const existingUser = await User.findOne({ email: normalizedEmail });
      
      // Generate unique invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      
      // Create team record with status 'invited' (ALWAYS - both for new and existing users)
      const teamData = {
        inviting_id: req.user.id,
        member_id: existingUser?._id || null, // Set member_id if user exists, null otherwise
        invitedEmail: normalizedEmail,
        status: 'invited', // ALWAYS start as 'invited' - requires email acceptance
        invitationToken: invitationToken,
        invitedAt: new Date(),
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
      
      console.log('Creating team invitation record with data:', JSON.stringify(teamData, null, 2));
      
      try {
        const newTeamRecord = await Team.create(teamData);
        console.log('✅ Created team invitation record:', newTeamRecord._id);
      } catch (createErr) {
        if (createErr.code === 11000) {
          // Duplicate key error - invitation token collision (very rare)
          console.error('Token collision, retrying...');
          const retryToken = crypto.randomBytes(32).toString('hex');
          teamData.invitationToken = retryToken;
          const newTeamRecord = await Team.create(teamData);
          console.log('✅ Created team invitation record (retry):', newTeamRecord._id);
        } else {
          throw createErr;
        }
      }
    }

    // Get the team record (newly created or existing)
    const teamRecord = await Team.findOne({
      inviting_id: req.user.id,
      invitedEmail: normalizedEmail,
      status: 'invited',
    });

    if (!teamRecord) {
      return res.status(500).json({ msg: 'Failed to create invitation' });
    }
    
    // Get inviter info - req.user is already populated by auth middleware
    const inviterName = req.user?.name || 'Admin';
    const inviterEmail = req.user?.email || '';
    console.log('Inviter info from req.user:', { id: req.user?.id || req.user?._id, name: inviterName, email: inviterEmail });

    // Construct frontend URLs with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const token = teamRecord.invitationToken;
    const loginUrl = `${frontendUrl}/login?inviteToken=${token}&email=${encodeURIComponent(normalizedEmail)}`;
    const registerUrl = `${frontendUrl}/register?inviteToken=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send invitation email - user chooses Login or Register
    const existingUser = await User.findOne({ email: normalizedEmail });
    const emailResult = await sendUserInvitation(
      email,
      inviterName,
      inviterEmail,
      loginUrl,
      registerUrl,
      existingUser ? 'login' : 'register',
      token
    );

    res.json({
      msg: 'Invitation sent successfully. User must accept via email to join the team.',
      emailSent: emailResult.success,
      userExists: !!existingUser,
    });
  } catch (err) {
    console.error('Error in sendInvite:', err);
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Invitation already sent to this email' });
    }
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Accept team invitation via email link (public endpoint - no auth required)
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ msg: 'Invitation token is required' });
    }

    // Import Team model
    const Team = (await import('../models/team.model.js')).default;

    // Find invitation by token
    const teamRecord = await Team.findOne({
      invitationToken: token,
      status: 'invited',
    }).populate('inviting_id', 'name email');

    if (!teamRecord) {
      return res.status(404).json({ 
        msg: 'Invitation not found or already accepted/declined',
      });
    }

    // Check if token is expired
    if (teamRecord.tokenExpiresAt && new Date() > teamRecord.tokenExpiresAt) {
      return res.status(400).json({ 
        msg: 'Invitation link has expired. Please request a new invitation.',
      });
    }

    // Update status to accepted
    teamRecord.status = 'accepted';
    teamRecord.acceptedAt = new Date();
    
    // If member_id is null, try to find user by email and set it
    if (!teamRecord.member_id) {
      const user = await User.findOne({ email: teamRecord.invitedEmail });
      if (user) {
        teamRecord.member_id = user._id;
      }
    }

    await teamRecord.save();

    console.log(`✅ Invitation accepted: Team record ${teamRecord._id}, invitedEmail: ${teamRecord.invitedEmail}`);

    // Return JSON response (frontend will handle redirect)
    const userExists = !!teamRecord.member_id;
    
    res.json({
      success: true,
      msg: 'Invitation accepted successfully',
      userExists: userExists,
      email: teamRecord.invitedEmail,
    });
  } catch (err) {
    console.error('Error in acceptInvitation:', err);
    res.status(500).json({ 
      success: false, 
      msg: 'Failed to accept invitation',
      error: err.message 
    });
  }
};


