import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Organization from '../models/organization.model.js';

dotenv.config();

export const register = async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body) {
      console.error('Registration error: req.body is undefined', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        contentType: req.headers['content-type']
      });
      return res.status(400).json({ 
        msg: 'Invalid request: request body is missing. Please ensure Content-Type is application/json.' 
      });
    }

    const { name, email, password, invitationToken, organizationName } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        msg: 'Name, email, and password are required' 
      });
    }

    let organizationId = null;
    let userRole = 'member';

    // If invitation token provided, validate and get organization
    if (invitationToken) {
      const OrganizationInvitation = (await import('../models/organizationInvitation.model.js')).default;
      const invitation = await OrganizationInvitation.findOne({
        invitationToken,
        status: 'invited',
        tokenExpiresAt: { $gt: new Date() },
      });

      if (!invitation) {
        return res.status(400).json({ msg: 'Invalid or expired invitation' });
      }

      organizationId = invitation.organization;
      // Explicitly get role from invitation, validate it, and default to 'member' if invalid
      const invitedRole = invitation.role;
      if (invitedRole && ['owner', 'admin', 'manager', 'member'].includes(invitedRole)) {
        userRole = invitedRole;
      } else {
        userRole = 'member';
      }
      console.log(`Registration: Setting user role to '${userRole}' from invitation role '${invitedRole}'`);
    } else if (organizationName) {
      // First user creates organization
      const organization = new Organization({
        name: organizationName,
        description: '',
        owner: null, // Will be set after user creation
      });
      await organization.save();
      organizationId = organization._id;
      userRole = 'owner'; // First user becomes owner
    } else {
      return res.status(400).json({ 
        msg: 'Organization invitation token or organization name required' 
      });
    }

    // Check if user already exists in THIS organization
    let user = await User.findOne({ 
      email: email.toLowerCase(),
      organization: organizationId 
    });

    if (user) {
      return res.status(400).json({ 
        msg: 'User already exists in this organization',
        error: 'You are already a member of this organization. Please log in instead.'
      });
    }

    // Check if user exists in ANY organization (for logging/info purposes)
    const existingUserInOtherOrg = await User.findOne({ 
      email: email.toLowerCase()
    });

    if (existingUserInOtherOrg) {
      console.log(`User ${email} already exists in organization ${existingUserInOtherOrg.organization}, creating new record for organization ${organizationId}`);
    }

    // Create new user record for this organization
    // Same email can exist in multiple organizations (each org has its own user record)
    user = new User({
      name,
      email: email.toLowerCase(),
      password,
      organization: organizationId,
      role: userRole,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    try {
      await user.save();
      console.log(`User created successfully: ${user.email} in organization ${organizationId} with role: ${user.role}`);
    } catch (saveErr) {
      console.error('Error saving user:', saveErr);
      
      // Handle duplicate key error (E11000)
      if (saveErr.code === 11000) {
        const keyPattern = saveErr.keyPattern || {};
        const keyValue = saveErr.keyValue || {};
        
        // Check if user actually exists in this organization now (race condition)
        const checkUser = await User.findOne({ 
          email: email.toLowerCase(),
          organization: organizationId 
        });
        
        if (checkUser) {
          return res.status(400).json({ 
            msg: 'User already exists in this organization',
            error: 'You are already a member of this organization. Please log in instead.'
          });
        }
        
        // If it's the compound index (email + organization), user should exist
        if (keyPattern.email === 1 && keyPattern.organization === 1) {
          return res.status(400).json({ 
            msg: 'User already exists in this organization',
            error: 'Duplicate email in organization'
          });
        }
        
        // If it's just email (old unique index on email only), this is a database issue
        if (keyPattern.email === 1 && !keyPattern.organization) {
          console.error('Old email_1 index detected! This prevents users from joining multiple organizations.');
          console.error('Error details:', {
            code: saveErr.code,
            keyPattern: saveErr.keyPattern,
            keyValue: saveErr.keyValue,
            index: saveErr.index,
            errmsg: saveErr.errmsg
          });
          
          return res.status(500).json({ 
            msg: 'Database configuration error. Please contact support.',
            error: 'Old database index detected. Run: node backend/scripts/force-drop-email-index.js',
            details: 'The database has an old unique index on email that prevents users from joining multiple organizations.'
          });
        }
        
        // Generic duplicate key error
        return res.status(400).json({ 
          msg: 'Registration failed: duplicate entry',
          error: 'Duplicate key error',
          details: saveErr.errmsg || saveErr.message
        });
      }
      
      throw saveErr; // Re-throw if not a duplicate key error
    }

    // If creating new organization, set user as owner
    if (userRole === 'owner') {
      await Organization.findByIdAndUpdate(organizationId, { owner: user._id });
    }

    // Update invitation if token was provided
    if (invitationToken) {
      const OrganizationInvitation = (await import('../models/organizationInvitation.model.js')).default;
      await OrganizationInvitation.findOneAndUpdate(
        { invitationToken },
        { 
          memberId: user._id,
          status: 'accepted',
          acceptedAt: new Date(),
        }
      );
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        organization: user.organization,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization,
          },
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    console.error('Error details:', {
      code: err.code,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue,
      index: err.index,
      errmsg: err.errmsg
    });
    
    // Handle duplicate key error (old email index or same email in same org)
    if (err.code === 11000) {
      const keyPattern = err.keyPattern || {};
      const keyValue = err.keyValue || {};
      
      // Check if user actually exists in this organization
      if (keyValue.email) {
        const existingUser = await User.findOne({ 
          email: keyValue.email,
          organization: organizationId 
        });
        
        if (existingUser) {
          return res.status(400).json({ 
            msg: 'User already exists in this organization',
            error: 'Duplicate email in organization'
          });
        }
      }
      
      // If it's a single-field email index (old index)
      if (keyPattern.email === 1 && !keyPattern.organization) {
        return res.status(400).json({ 
          msg: 'Email registration failed. Please run: node backend/scripts/force-drop-email-index.js',
          error: 'Database index issue detected',
          details: 'Old email index may exist. Run the migration script to fix it.'
        });
      }
      
      // If it's the compound index but user doesn't exist, it's a race condition or stale data
      if (keyPattern.email === 1 && keyPattern.organization === 1) {
        return res.status(400).json({ 
          msg: 'User already exists in this organization',
          error: 'Duplicate email in organization'
        });
      }
      
      // Generic duplicate key error
      return res.status(400).json({ 
        msg: 'Registration failed: duplicate entry detected',
        error: 'Duplicate key error',
        details: err.errmsg || err.message
      });
    }
    
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body) {
      console.error('Login error: req.body is undefined', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        contentType: req.headers['content-type']
      });
      return res.status(400).json({ 
        msg: 'Invalid request: request body is missing. Please ensure Content-Type is application/json.' 
      });
    }

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        msg: 'Email and password are required' 
      });
    }

    // Note: Since email is not unique globally, we might need organization context
    // For now, find first user with this email (in production, you might want to add org selection)
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
        organization: user.organization,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            organization: user.organization,
          },
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


