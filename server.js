import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Routes
import authRoutes from './routes/authRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import boardsRoutes from './routes/boardsRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Serve uploaded files statically (before API routes to avoid conflicts)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello',
      {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    if (err.message.includes('IP')) {
      console.error('\n⚠️  IP Whitelist Issue:');
      console.error('1. Go to MongoDB Atlas → Network Access');
      console.error('2. Click "Add IP Address"');
      console.error('3. Add your current IP or use 0.0.0.0/0 (development only)');
      console.error('4. Wait 1-2 minutes for changes to propagate\n');
    }
    process.exit(1);
  }
};

connectDB();

// Start Server (ONLY ONCE)
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
