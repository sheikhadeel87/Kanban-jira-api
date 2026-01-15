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
import teamRoutes from './routes/teamRoutes.js';

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

// CORS configuration - must be before other middleware
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
    
    // Log blocked origin for debugging
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
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

// Debug route to check path handling
app.get('/debug', (req, res) => {
  res.json({
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
});

// CORS test route
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working',
    origin: req.headers.origin,
    headers: req.headers
  });
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

// Middleware to normalize paths (fix double /api/api issue from Vercel rewrites)
app.use((req, res, next) => {
  // Log incoming request for debugging (always log in production to debug routing)
  // console.log('Incoming request:', {
  //   method: req.method,
  //   path: req.path,
  //   url: req.url,
  //   originalUrl: req.originalUrl,
  //   baseUrl: req.baseUrl
  // });
  
  // Fix double /api/api prefix that occurs when Vercel rewrites /api/* to /api
  // When request is /api/auth/login, Vercel rewrites to /api, but Express receives /api/api/auth/login
  const originalUrl = req.originalUrl || req.url;
  if (originalUrl.startsWith('/api/api/')) {
    const fixedUrl = originalUrl.replace(/^\/api\/api/, '/api');
    req.url = fixedUrl;
    req.originalUrl = fixedUrl;
    // Also update path
    if (req.path.startsWith('/api/api/')) {
      req.path = req.path.replace(/^\/api\/api/, '/api');
    }
    console.log('Fixed path from', originalUrl, 'to', fixedUrl);
  }
  next();
});

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
// Handle both /api/* (local dev) and /* (Vercel may strip /api prefix)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/boards', boardsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/users', userRoutes);
// Debug middleware before routes
app.use('/api/teams', (req, res, next) => {
  console.log(`🔍 Teams API request: ${req.method} ${req.originalUrl} -> ${req.path}`);
  next();
});
app.use('/api/teams', teamRoutes);
app.use('/teams', teamRoutes);

// Catch-all route for debugging (should be last)
// Use middleware without path pattern to catch all unmatched routes
app.use((req, res) => {
  console.log('Catch-all route hit:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    message: 'This route does not exist. Check the path and method.'
  });
});

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