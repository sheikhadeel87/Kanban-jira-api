import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/user.model.js';

dotenv.config();

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    // Return array directly for consistency with other APIs
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
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


