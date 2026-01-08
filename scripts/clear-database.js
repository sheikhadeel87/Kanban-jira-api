/**
 * Clear Database Script
 * 
 * ⚠️ WARNING: This will DELETE ALL DATA in your database!
 * Use only for development/testing purposes.
 * 
 * Usage: node scripts/clear-database.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello';

async function clearDatabase() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data!');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log(`\n📋 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`   - ${col.name}`));

    // Drop all collections
    for (const collection of collections) {
      await db.collection(collection.name).drop();
      console.log(`   ✅ Dropped ${collection.name}`);
    }

    console.log('\n✅ Database cleared successfully!');
    console.log('You can now restart your server and start fresh.');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    if (error.message.includes('ns not found')) {
      console.log('ℹ️  Database is already empty or collections do not exist.');
      await mongoose.disconnect();
      process.exit(0);
    } else {
      console.error('❌ Error clearing database:', error);
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

// Run
clearDatabase();

