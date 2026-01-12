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

const allowedOrigins = [
  'https://trello-client-six.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow all Vercel preview URLs (for preview deployments)
    if (origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create uploads directory if it doesn't exist (for backward compatibility with old files)
// const uploadsDir = path.join(__dirname, 'uploads');
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
//   console.log('Created uploads directory');
// }

// Test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Serve uploaded files statically (for backward compatibility with old local files)
// New uploads go to Cloudinary, but old files can still be served from here
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection - Serverless-safe with caching
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // If no connection promise exists, create one
  if (!cached.promise) {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello';
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const opts = {
      bufferCommands: false, // Disable mongoose buffering for serverless
      serverSelectionTimeoutMS: 10000, // Increase timeout for serverless
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch((err) => {
      // Clear promise on error so we can retry
      cached.promise = null;
      console.error('MongoDB connection error:', err.message);
      if (err.message.includes('IP')) {
        console.error('\n⚠️  IP Whitelist Issue:');
        console.error('1. Go to MongoDB Atlas → Network Access');
        console.error('2. Click "Add IP Address"');
        console.error('3. Add your current IP or use 0.0.0.0/0 (development only)');
        console.error('4. Wait 1-2 minutes for changes to propagate\n');
      }
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};

// Middleware to ensure DB connection before handling requests (serverless-safe)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).json({ 
      msg: 'Database connection error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);

// Start Server (ONLY ONCE)
// const PORT = process.env.PORT || 5005;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


//vercel deployment
// ... existing imports and code ...

// Remove or comment out the app.listen() part:
// const PORT = process.env.PORT || 5005;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// Export app for Vercel
export default app;

// Only listen in development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5005;
  
  // Optional: Eagerly connect in development for better DX (non-blocking)
  connectDB().catch((err) => {
    console.warn('⚠️  Could not connect to MongoDB on startup (will retry on first request):', err.message);
  });
  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}