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
      // Role determined by invitation or defaults to member
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

    // Check if user already exists in this organization
    let user = await User.findOne({ 
      email: email.toLowerCase(),
      organization: organizationId 
    });

    if (user) {
      return res.status(400).json({ msg: 'User already exists in this organization' });
    }

    user = new User({
      name,
      email: email.toLowerCase(),
      password,
      organization: organizationId,
      role: userRole,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

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


