# MongoDB Migration Guide

This guide explains how to update your MongoDB database with the new Workspace-based structure.

## ⚠️ Important Notes

- **Backup your database first!** This migration will modify your data.
- If you're starting fresh (no existing data), you can skip this migration.
- The new structure uses **Workspace → Board → Task** hierarchy instead of **Team → Board → Task**.

---

## Option 1: Fresh Start (Recommended for Development)

If you don't have important data or want to start fresh:

### Steps:

1. **Stop your backend server** (Ctrl+C)

2. **Clear your MongoDB database:**
   
   **For MongoDB Atlas (Cloud):**
   - Go to MongoDB Atlas Dashboard
   - Navigate to your cluster → Collections
   - Delete all collections manually, OR
   - Use MongoDB Compass to drop the database

   **For Local MongoDB:**
   ```bash
   # Connect to MongoDB
   mongosh
   
   # Switch to your database
   use Kanban-Trello
   
   # Drop all collections
   db.dropDatabase()
   ```

3. **Restart your backend server:**
   ```bash
   cd backend
   npm start
   ```

4. **Mongoose will automatically create new collections** with the updated schema when you:
   - Register a new user
   - Create a workspace
   - Create a board
   - Create a task

---

## Option 2: Migrate Existing Data

If you have existing data that you want to preserve:

### Steps:

1. **Backup your database first!**
   
   **For MongoDB Atlas:**
   - Use the built-in backup feature in Atlas
   - Or export using `mongodump`

   **For Local MongoDB:**
   ```bash
   mongodump --uri="mongodb://localhost:27017/Kanban-Trello" --out=./backup
   ```

2. **Run the migration script:**
   ```bash
   cd backend
   node migrations/migrate-to-workspace.js
   ```

3. **The script will:**
   - Create a default workspace for each board owner
   - Update all boards to reference their workspace
   - Update tasks to use the new `assignedTo` array structure
   - Remove old `assignedToTeam` references

4. **Verify the migration:**
   - Check that workspaces were created
   - Verify boards have workspace references
   - Confirm tasks are updated correctly

---

## Option 3: Manual Migration (Advanced)

If you prefer to migrate manually or the script doesn't fit your needs:

### Step 1: Create Workspaces

For each unique board owner, create a workspace:

```javascript
// In MongoDB shell or Compass
db.workspaces.insertOne({
  name: "User's Workspace",
  description: "Migrated workspace",
  createdBy: ObjectId("..."), // Board owner ID
  members: [{
    user: ObjectId("..."), // Board owner ID
    role: "admin"
  }],
  createdAt: new Date(),
  updatedAt: new Date()
})
```

### Step 2: Update Boards

Add workspace reference to each board:

```javascript
db.boards.updateMany(
  { workspace: { $exists: false } },
  { $set: { workspace: ObjectId("...") } } // Workspace ID
)
```

### Step 3: Update Tasks

Remove team assignment and ensure assignedTo is an array:

```javascript
// Remove assignedToTeam
db.tasks.updateMany(
  { assignedToTeam: { $exists: true } },
  { $unset: { assignedToTeam: "" } }
)

// Ensure assignedTo is an array
db.tasks.updateMany(
  { assignedTo: { $exists: false } },
  { $set: { assignedTo: [] } }
)

// Update userId to createdBy if needed
db.tasks.updateMany(
  { userId: { $exists: true }, createdBy: { $exists: false } },
  [{ $set: { createdBy: "$userId" } }]
)
```

---

## Schema Changes Summary

### New Model: Workspace
```javascript
{
  name: String,
  description: String,
  members: [{
    user: ObjectId (ref: User),
    role: String (enum: ['admin', 'member'])
  }],
  createdBy: ObjectId (ref: User)
}
```

### Updated: Board Model
- ✅ Added: `workspace: ObjectId (ref: Workspace)` - **REQUIRED**
- ❌ Removed: Nothing (backward compatible)

### Updated: Task Model
- ✅ Added: `assignedTo: [ObjectId]` - Array of user IDs
- ✅ Added: `createdBy: ObjectId (ref: User)` - Task creator
- ❌ Removed: `assignedToTeam: ObjectId` - No longer used
- ❌ Removed: `userId` - Replaced by `createdBy`

---

## Verification Checklist

After migration, verify:

- [ ] Workspaces collection exists and has data
- [ ] All boards have a `workspace` field
- [ ] All tasks have `assignedTo` as an array
- [ ] All tasks have `createdBy` field
- [ ] No tasks have `assignedToTeam` field
- [ ] Backend server starts without errors
- [ ] You can create/view workspaces in the frontend
- [ ] You can create/view boards within workspaces
- [ ] Tasks can be assigned to users

---

## Troubleshooting

### Error: "workspace is required"
- **Solution:** Make sure all boards have a workspace reference. Run the migration script or manually update boards.

### Error: "assignedToTeam is not defined"
- **Solution:** This is expected. The field was removed. If you see this error, make sure you've updated your Task model code.

### Existing data not showing
- **Solution:** Check that:
  1. Workspaces were created for your users
  2. Boards reference the correct workspace
  3. You're a member of the workspace to see its boards

### Migration script fails
- **Solution:** 
  1. Check MongoDB connection string
  2. Ensure all models are imported correctly
  3. Check that you have write permissions
  4. Review error messages for specific issues

---

## Need Help?

If you encounter issues:
1. Check the error messages in the console
2. Verify your MongoDB connection
3. Ensure all model files are updated
4. Check that the migration script has the correct paths

---

## After Migration

Once migration is complete:
1. ✅ Restart your backend server
2. ✅ Test creating a new workspace
3. ✅ Test creating a board within a workspace
4. ✅ Test assigning users to tasks
5. ✅ Verify old data is accessible

Your database is now ready for the new Workspace-based structure! 🎉

