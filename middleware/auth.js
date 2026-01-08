import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    const userId = decoded?.user?.id || decoded?.id;
    req.user = await User.findById(userId).select('-password');

    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Admin only middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

export { admin };
export default auth;
