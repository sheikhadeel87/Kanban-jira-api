import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/user.model.js';

dotenv.config();

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      role: role || 'user',
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Link user to Team table invitations
    // Set member_id for ALL invitations with this email (both 'invited' and 'accepted')
    try {
      const Team = (await import('../models/team.model.js')).default;
      
      // Update all pending and accepted invitations with this email to set member_id
      const updateResult = await Team.updateMany(
        { 
          invitedEmail: email.toLowerCase().trim(),
          member_id: null, // Only update records where member_id is not set
        },
        { 
          member_id: user._id,
        }
      );
      
      console.log(`✅ Linked ${updateResult.modifiedCount} invitation(s) to registered user: ${email}, member_id set to ${user._id}`);
    } catch (inviteErr) {
      // Don't fail registration if invitation linking fails
      console.error('Error linking invitation to Team table:', inviteErr);
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
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
          },
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Link user to any accepted Team invitations where member_id is null
    try {
      const Team = (await import('../models/team.model.js')).default;
      
      // Update accepted invitations with this email to set member_id
      const updateResult = await Team.updateMany(
        { 
          invitedEmail: email.toLowerCase().trim(),
          member_id: null, // Only update records where member_id is not set
          status: 'accepted', // Only link accepted invitations
        },
        { 
          member_id: user._id,
        }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`✅ Linked ${updateResult.modifiedCount} accepted invitation(s) to logged-in user: ${email}`);
      }
    } catch (inviteErr) {
      // Don't fail login if invitation linking fails
      console.error('Error linking invitation on login:', inviteErr);
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
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
          },
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error', err.message);
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


