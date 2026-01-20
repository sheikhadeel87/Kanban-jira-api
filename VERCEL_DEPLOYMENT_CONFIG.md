# Vercel Deployment Configuration - Working Setup

This document contains the **working configuration** for deploying the Kanban Board backend to Vercel. This setup has been tested and verified to work correctly.

## ✅ Status
- **Backend**: Working perfectly on Vercel
- **Frontend Integration**: Successfully integrated with `https://trello-client-six.vercel.app`
- **MongoDB**: Connected with serverless-safe caching
- **CORS**: Configured and working
- **Routes**: All API endpoints functional

## 📁 Key Files

### 1. `backend/vercel.json`
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ],
  "functions": {
    "api/index.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

**Purpose**: Routes all requests to the serverless function at `api/index.js`

### 2. `backend/api/index.js`
```javascript
import app from '../server.js';

export default app;
```

**Purpose**: Entry point for Vercel serverless function

### 3. `backend/server.js` - Key Configurations

#### MongoDB Connection (Serverless-Safe)
- Uses `global.mongoose` for connection caching
- Lazy connection (connects on first request)
- No `process.exit()` - returns HTTP errors instead
- Connection middleware ensures DB is connected before handling requests

#### CORS Configuration
```javascript
const allowedOrigins = [
  'https://trello-client-six.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.includes('.vercel.app')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

#### Path Normalization Middleware
- Fixes double `/api/api` prefix issue caused by Vercel rewrites
- Logs all incoming requests for debugging
- Normalizes paths before routing

#### Routes
- Handles both `/api/*` and `/*` patterns for compatibility
- All routes registered: `/api/auth`, `/api/workspaces`, `/api/boards`, `/api/tasks`, `/api/users`

## 🔧 How It Works

1. **Request Flow**:
   - Request: `https://trello-api-drab.vercel.app/api/auth/login`
   - Vercel rewrite: Routes to `/api` function (`api/index.js`)
   - Express receives: `/api/api/auth/login` (due to rewrite)
   - Path normalization: Fixes to `/api/auth/login`
   - Route matches: `app.use('/api/auth', authRoutes)` ✅

2. **MongoDB Connection**:
   - First request: Connects to MongoDB and caches connection
   - Subsequent requests: Reuses cached connection (fast)
   - Serverless-safe: Works with Vercel's cold starts

3. **CORS**:
   - Allows frontend: `https://trello-client-six.vercel.app`
   - Allows all `.vercel.app` domains (for preview deployments)
   - Handles OPTIONS preflight requests automatically

## 🌍 Environment Variables (Vercel Dashboard)

Required environment variables in Vercel:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT token signing
- `CLOUDINARY_CLOUD_NAME`: (if using Cloudinary)
- `CLOUDINARY_API_KEY`: (if using Cloudinary)
- `CLOUDINARY_API_SECRET`: (if using Cloudinary)

**Important**: Add these to Production, Preview, and Development environments in Vercel Dashboard.

## 🚀 Deployment URLs

- **Backend API**: `https://trello-api-drab.vercel.app`
- **Frontend**: `https://trello-client-six.vercel.app`

## 📝 Important Notes

1. **Path Normalization**: The middleware fixes the double `/api/api` prefix that occurs due to Vercel's rewrite rules. This is critical for routing to work.

2. **MongoDB Caching**: Uses `global.mongoose` to cache connections across serverless invocations. This is essential for performance on Vercel.

3. **No process.exit()**: Serverless functions must never call `process.exit()`. All errors return HTTP responses instead.

4. **CORS**: Configured to allow all Vercel preview URLs automatically, so preview deployments work without additional configuration.

5. **Routes**: Registered with both `/api/*` and `/*` patterns to handle different path scenarios.

## 🐛 Troubleshooting

### If routes return 404:
- Check Vercel logs for path normalization logs
- Verify `vercel.json` rewrite rule is present
- Check that routes are registered correctly

### If CORS errors occur:
- Verify frontend URL is in `allowedOrigins` or matches `.vercel.app` pattern
- Check Vercel logs for "CORS blocked origin" messages
- Ensure CORS middleware is before other middleware

### If MongoDB connection fails:
- Verify `MONGODB_URI` is set in Vercel environment variables
- Check MongoDB Atlas IP whitelist (should allow all IPs: `0.0.0.0/0`)
- Check Vercel function logs for connection errors


## ⚠️ Previous Issues & Solutions

### Issue 1: 404 NOT_FOUND Errors
**Problem**: All API routes were returning `404 NOT_FOUND` errors on Vercel, even though they worked locally and in Postman.

**Root Causes**:
1. Missing rewrite rule in `vercel.json` - Vercel wasn't routing `/api/*` requests to the serverless function
2. Double `/api/api` path prefix - When Vercel rewrote requests, Express was receiving `/api/api/auth/login` instead of `/api/auth/login`
3. Incorrect catch-all route pattern - Using `app.all('*', ...)` caused path-to-regexp parsing errors

**Solutions Applied**:
1. Added rewrite rule: `"source": "/(.*)", "destination": "/api"` in `vercel.json`
2. Created path normalization middleware to fix double `/api/api` prefixes
3. Changed catch-all route from `app.all('*', ...)` to `app.use((req, res) => {...})`

**Key Files Modified**:
- `backend/vercel.json` - Added rewrite rules
- `backend/server.js` - Added path normalization middleware, fixed catch-all route

### Issue 2: CORS Errors
**Problem**: Frontend requests from `https://trello-client-six.vercel.app` were being blocked by CORS policy.

**Error Messages**:
```
Access to XMLHttpRequest at 'https://trello-api-drab.vercel.app/api/auth/login' 
from origin 'https://trello-client-six.vercel.app' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Root Causes**:
1. Frontend URL not in `allowedOrigins` list
2. CORS middleware not properly handling OPTIONS preflight requests
3. Missing headers in CORS configuration

**Solutions Applied**:
1. Added `https://trello-client-six.vercel.app` to `allowedOrigins` array
2. Added pattern to allow all `.vercel.app` domains (for preview deployments)
3. Enhanced CORS configuration with proper headers:
   - Added `X-Requested-With` to `allowedHeaders`
   - Added `exposedHeaders` configuration
   - Set `optionsSuccessStatus: 204` for OPTIONS requests
4. Ensured CORS middleware is placed before other middleware

**Key Files Modified**:
- `backend/server.js` - Enhanced CORS configuration

### Issue 3: Double `/api/api` URL Problem
**Problem**: Requests were being made to `/api/api/auth/login` instead of `/api/auth/login`, causing 404 errors.

**Root Cause**: 
- Vercel rewrite rule `/(.*)` → `/api` was routing requests, but Express was receiving the path with an extra `/api` prefix
- Frontend API configuration was also adding `/api` to URLs that already contained it

**Solutions Applied**:
1. Path normalization middleware in `server.js` that detects and fixes double `/api/api` prefixes
2. Fixed frontend API URL normalization in `ui/src/services/api.js` to prevent double `/api` in base URL

**Key Files Modified**:
- `backend/server.js` - Added path normalization middleware
- `ui/src/services/api.js` - Fixed URL normalization logic

### Issue 4: MongoDB Connection Failures on Vercel
**Problem**: MongoDB connections were failing on Vercel serverless functions, even though they worked locally.

**Root Causes**:
1. Connection attempted at import time (not serverless-safe)
2. No connection caching (reconnecting on every request)
3. Using `process.exit()` on errors (crashes serverless functions)

**Solutions Applied**:
1. Implemented serverless-safe MongoDB connection with `global.mongoose` caching
2. Lazy connection (only connects when needed, not at import time)
3. Connection middleware ensures DB is connected before handling requests
4. Removed `process.exit()` - returns HTTP errors instead

**Key Files Modified**:
- `backend/server.js` - Implemented serverless-safe MongoDB connection pattern

## 📚 Lessons Learned

1. **Vercel Routing**: Always need explicit rewrite rules in `vercel.json` to route requests to serverless functions
2. **Path Handling**: Vercel rewrites can cause path duplication - always normalize paths
3. **CORS**: Must explicitly allow frontend domains, and allow all preview deployment URLs
4. **Serverless Functions**: Never use `process.exit()`, always cache connections, lazy-load everything
5. **Error Handling**: Return HTTP responses instead of crashing functions

## ✅ Verification Checklist

After deployment, verify:
- [ ] Root route works: `curl https://trello-api-drab.vercel.app/`
- [ ] API routes work: `curl -X POST https://trello-api-drab.vercel.app/api/auth/login ...`
- [ ] CORS works from frontend
- [ ] MongoDB connects successfully (check logs)
- [ ] All environment variables are set in Vercel

## 📅 Last Verified
- Date: January 13, 2025
- Status: ✅ Working perfectly
- Backend integrated with Vercel UI
- Frontend successfully communicating with backend

---

**Note**: This configuration has been tested and verified to work. Do not modify without understanding the implications, especially the path normalization middleware and MongoDB connection caching.

