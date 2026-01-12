# Kanban Board API Documentation

## Base URL
```
http://localhost:5005/api
```

## Authentication
Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### 1. Register User
**POST** `/auth/register`

**Description:** Register a new user account

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user"  // optional: "user" or "admin", defaults to "user"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

### 2. Login
**POST** `/auth/login`

**Description:** Login and get JWT token

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Error (400):**
```json
{
  "msg": "Invalid credentials"
}
```

---

### 3. Get Current User
**GET** `/auth/me`

**Description:** Get current authenticated user information

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Board Endpoints

### 4. Get All Boards
**GET** `/boards`

**Description:** Get all boards where user is owner or member

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Project Board",
    "description": "Main project board",
    "owner": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "members": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 5. Get Board by ID
**GET** `/boards/:id`

**Description:** Get a specific board by ID

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Board ID

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Project Board",
  "description": "Main project board",
  "owner": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "members": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (404):**
```json
{
  "msg": "Board not found"
}
```

---

### 6. Create Board
**POST** `/boards`

**Description:** Create a new board

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "title": "New Project Board",
  "description": "Board description"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "New Project Board",
  "description": "Board description",
  "owner": "507f1f77bcf86cd799439012",
  "members": ["507f1f77bcf86cd799439012"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 7. Update Board
**PUT** `/boards/:id`

**Description:** Update a board (only owner can update)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Parameters:**
- `id` (path) - Board ID

**Body (JSON):**
```json
{
  "title": "Updated Board Title",
  "description": "Updated description"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Updated Board Title",
  "description": "Updated description",
  "owner": "507f1f77bcf86cd799439012",
  "members": [...],
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (401):**
```json
{
  "msg": "Not authorized"
}
```

---

### 8. Delete Board
**DELETE** `/boards/:id`

**Description:** Delete a board (only owner can delete)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Board ID

**Response (200):**
```json
{
  "msg": "Board removed"
}
```

**Error (401):**
```json
{
  "msg": "Not authorized"
}
```

---

## Task Endpoints

### 9. Get Tasks by Board
**GET** `/tasks/board/:boardId`

**Description:** Get all tasks for a specific board

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `boardId` (path) - Board ID

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "title": "Task Title",
    "description": "Task description",
    "status": "todo",
    "board": "507f1f77bcf86cd799439011",
    "assignedToTeam": {
      "_id": "507f1f77bcf86cd799439014",
      "members": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "name": "John Doe",
          "email": "john@example.com"
        }
      ]
    },
    "userId": "507f1f77bcf86cd799439012",
    "attachment": null,
    "order": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 10. Create Task
**POST** `/tasks`

**Description:** Create a new task

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (Form Data):**
```
title: "New Task"
description: "Task description"
status: "todo"  // optional: "todo", "in_progress", "completed" (default: "todo")
board: "507f1f77bcf86cd799439011"  // required
assignedToTeam: "507f1f77bcf86cd799439014"  // optional
attachment: [file]  // optional
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "title": "New Task",
  "description": "Task description",
  "status": "todo",
  "board": "507f1f77bcf86cd799439011",
  "assignedToTeam": {
    "_id": "507f1f77bcf86cd799439014",
    "members": [...]
  },
  "userId": "507f1f77bcf86cd799439012",
  "attachment": "1234567890.jpg",
  "order": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 11. Update Task
**PUT** `/tasks/:id`

**Description:** Update a task (task creator, admin, or team members can update)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Parameters:**
- `id` (path) - Task ID

**Body (Form Data):**
```
title: "Updated Task Title"  // optional
description: "Updated description"  // optional
status: "in_progress"  // optional: "todo", "in_progress", "completed"
assignedToTeam: "507f1f77bcf86cd799439014"  // optional
attachment: [file]  // optional
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "title": "Updated Task Title",
  "description": "Updated description",
  "status": "in_progress",
  "board": "507f1f77bcf86cd799439011",
  "assignedToTeam": {...},
  "userId": "507f1f77bcf86cd799439012",
  "attachment": "1234567890.jpg",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (403):**
```json
{
  "msg": "Not authorized"
}
```

---

### 12. Update Task Status
**PATCH** `/tasks/:id/status`

**Description:** Update only the status of a task (task creator, admin, assigned user, or team members can update)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Parameters:**
- `id` (path) - Task ID

**Body (JSON):**
```json
{
  "status": "completed"  // "todo", "in_progress", or "completed"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "title": "Task Title",
  "status": "completed",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (403):**
```json
{
  "msg": "Not authorized"
}
```

---

### 13. Delete Task
**DELETE** `/tasks/:id`

**Description:** Delete a task (only task creator or admin can delete)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `id` (path) - Task ID

**Response (200):**
```json
{
  "msg": "Task removed"
}
```

**Error (403):**
```json
{
  "msg": "Not authorized"
}
```

---

## Team Endpoints

**Note:** Team routes should be added to server.js as `/api/teams`

### 14. Create Team
**POST** `/teams`

**Description:** Create a team for a board (board creator becomes first member)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "boardId": "507f1f77bcf86cd799439011"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "board": "507f1f77bcf86cd799439011",
  "members": ["507f1f77bcf86cd799439012"],
  "createdBy": "507f1f77bcf86cd799439012",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (403):**
```json
{
  "msg": "Not authorized"
}
```

---

### 15. Get Team by Board
**GET** `/teams/board/:boardId`

**Description:** Get team information for a board (only team members can view)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `boardId` (path) - Board ID

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "board": "507f1f77bcf86cd799439011",
  "members": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "createdBy": "507f1f77bcf86cd799439012",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (403):**
```json
{
  "msg": "Access denied"
}
```

---

### 16. Add Member to Team
**POST** `/teams/:teamId/add`

**Description:** Add a user to a team (only board creator or admin)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Parameters:**
- `teamId` (path) - Team ID

**Body (JSON):**
```json
{
  "userId": "507f1f77bcf86cd799439015"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "board": "507f1f77bcf86cd799439011",
  "members": [
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439015"
  ],
  "createdBy": "507f1f77bcf86cd799439012",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error (400):**
```json
{
  "msg": "User already in team"
}
```

---

### 17. Remove Member from Team
**DELETE** `/teams/:teamId/remove/:userId`

**Description:** Remove a user from a team (only board creator or admin)

**Headers:**
```
Authorization: Bearer <token>
```

**Parameters:**
- `teamId` (path) - Team ID
- `userId` (path) - User ID to remove

**Response (200):**
```json
{
  "msg": "Member removed"
}
```

**Error (403):**
```json
{
  "msg": "Not authorized"
}
```

---

## User Endpoints

### 18. Get All Users
**GET** `/users`

**Description:** Get all users (no authentication required)

**Response (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 19. Get User by ID
**GET** `/users/:id`

**Description:** Get a specific user by ID

**Parameters:**
- `id` (path) - User ID

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 20. Create User
**POST** `/users`

**Description:** Create a new user

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439016",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 21. Update User
**PUT** `/users/:id`

**Description:** Update a user

**Headers:**
```
Content-Type: application/json
```

**Parameters:**
- `id` (path) - User ID

**Body (JSON):**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "Updated Name",
  "email": "updated@example.com",
  "role": "user",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 22. Delete User
**DELETE** `/users/:id`

**Description:** Delete a user

**Parameters:**
- `id` (path) - User ID

**Response (200):**
```json
{
  "msg": "User deleted"
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "message": "Not authorized"
}
```

### 403 Forbidden
```json
{
  "msg": "Not authorized"
}
```

### 404 Not Found
```json
{
  "msg": "Resource not found"
}
```

### 500 Server Error
```
Server error
```

---

## Postman Collection Setup

### Environment Variables
Create a Postman environment with:
- `base_url`: `http://localhost:5005/api`
- `token`: (will be set after login)

### Pre-request Script (for authenticated endpoints)
```javascript
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('token')
});
```

### Tests Script (for login/register)
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.environment.set("token", jsonData.token);
}
```

---

## Notes

1. **JWT Token Expiry**: Tokens expire after 7 days
2. **File Uploads**: Task attachments are stored in the `uploads/` directory
3. **Task Status**: Valid values are `"todo"`, `"in_progress"`, `"completed"`
4. **User Roles**: Valid values are `"user"` or `"admin"`
5. **Team Routes**: Make sure to add team routes to `server.js`:
   ```javascript
   import teamRoutes from './routes/teamRoutes.js';
   app.use('/api/teams', teamRoutes);
   ```

