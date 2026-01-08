/**
 * Migration Script: Migrate from Team-based to Workspace-based structure
 * 
 * This script will:
 * 1. Create a default workspace for existing boards
 * 2. Update boards to reference workspace
 * 3. Update tasks to use assignedTo array instead of assignedToTeam
 * 
 * Run this script ONCE after updating your models
 * 
 * Usage: node migrations/migrate-to-workspace.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Board from '../models/board.model.js';
import Task from '../models/task.model.js';
import Workspace from '../models/workspace.model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello';

async function migrate() {
  try {
    console.log('🔄 Starting migration...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Create default workspace for each board owner
    console.log('\n📦 Step 1: Creating workspaces for existing boards...');
    
    const boards = await Board.find({});
    const processedOwners = new Set();
    
    for (const board of boards) {
      const ownerId = board.owner.toString();
      
      if (!processedOwners.has(ownerId)) {
        // Check if workspace already exists for this owner
        const existingWorkspace = await Workspace.findOne({ createdBy: ownerId });
        
        if (!existingWorkspace) {
          const owner = await User.findById(ownerId);
          const workspace = new Workspace({
            name: `${owner?.name || 'User'}'s Workspace`,
            description: 'Migrated workspace',
            createdBy: ownerId,
            members: [
              {
                user: ownerId,
                role: 'admin',
              },
            ],
          });
          
          await workspace.save();
          console.log(`  ✅ Created workspace for user ${ownerId}`);
        }
        
        processedOwners.add(ownerId);
      }
    }

    // Step 2: Update boards to reference workspace
    console.log('\n📋 Step 2: Updating boards to reference workspace...');
    
    for (const board of boards) {
      if (!board.workspace) {
        const ownerId = board.owner.toString();
        const workspace = await Workspace.findOne({ createdBy: ownerId });
        
        if (workspace) {
          board.workspace = workspace._id;
          await board.save();
          console.log(`  ✅ Updated board ${board._id} with workspace ${workspace._id}`);
        }
      }
    }

    // Step 3: Update tasks - remove team assignment, add user assignment
    console.log('\n📝 Step 3: Updating tasks...');
    
    const tasks = await Task.find({});
    let updatedTasks = 0;
    
    for (const task of tasks) {
      let needsUpdate = false;
      
      // Remove assignedToTeam if it exists
      if (task.assignedToTeam) {
        task.assignedToTeam = undefined;
        needsUpdate = true;
      }
      
      // Update userId to createdBy if needed
      if (task.userId && !task.createdBy) {
        task.createdBy = task.userId;
        needsUpdate = true;
      }
      
      // Ensure assignedTo is an array
      if (!task.assignedTo || !Array.isArray(task.assignedTo)) {
        task.assignedTo = [];
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await task.save();
        updatedTasks++;
        console.log(`  ✅ Updated task ${task._id}`);
      }
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`   - Workspaces created: ${processedOwners.size}`);
    console.log(`   - Boards updated: ${boards.length}`);
    console.log(`   - Tasks updated: ${updatedTasks}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrate();

