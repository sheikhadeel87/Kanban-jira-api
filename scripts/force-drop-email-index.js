import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello';

async function forceDropEmailIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get all indexes
    const indexes = await usersCollection.indexes();
    console.log('\n📋 All current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
    });

    // Try to drop email_1 index by name (most common case)
    console.log('\n🔍 Attempting to drop email_1 index...');
    try {
      await usersCollection.dropIndex('email_1');
      console.log('✅ Successfully dropped email_1 index');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('ℹ️  email_1 index not found (this is OK)');
      } else {
        console.log('⚠️  Could not drop email_1 by name:', err.message);
      }
    }

    // Try to drop by key pattern
    console.log('\n🔍 Attempting to drop index by key pattern { email: 1 }...');
    try {
      await usersCollection.dropIndex({ email: 1 });
      console.log('✅ Successfully dropped index by key pattern');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('ℹ️  Index with pattern { email: 1 } not found (this is OK)');
      } else {
        console.log('⚠️  Could not drop by key pattern:', err.message);
      }
    }

    // Try using db.command for force drop
    console.log('\n🔍 Attempting force drop using db.command...');
    try {
      const result = await db.command({ 
        dropIndexes: 'users', 
        index: 'email_1' 
      });
      console.log('✅ Force drop result:', result);
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('ℹ️  email_1 index does not exist (confirmed)');
      } else {
        console.log('⚠️  Force drop failed:', err.message);
      }
    }

    // Find and drop any single-field email index
    const singleEmailIndexes = indexes.filter(idx => {
      const keys = Object.keys(idx.key || {});
      return keys.length === 1 && keys[0] === 'email' && idx.name !== '_id_';
    });

    if (singleEmailIndexes.length > 0) {
      console.log('\n⚠️  Found single-field email indexes:');
      for (const idx of singleEmailIndexes) {
        console.log(`  Dropping: ${idx.name}`);
        try {
          await usersCollection.dropIndex(idx.name);
          console.log(`  ✅ Dropped: ${idx.name}`);
        } catch (dropErr) {
          console.log(`  ❌ Failed to drop ${idx.name}:`, dropErr.message);
        }
      }
    }

    // Verify final state
    const finalIndexes = await usersCollection.indexes();
    console.log('\n📋 Final indexes:');
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
    });

    // Ensure compound index exists
    const hasCompoundIndex = finalIndexes.some(idx => {
      const keys = Object.keys(idx.key || {});
      return keys.length === 2 && 
             keys.includes('email') && 
             keys.includes('organization') &&
             idx.unique === true;
    });

    if (!hasCompoundIndex) {
      console.log('\n📝 Creating compound unique index...');
      await usersCollection.createIndex(
        { email: 1, organization: 1 },
        { unique: true, name: 'email_1_organization_1' }
      );
      console.log('✅ Compound index created');
    } else {
      console.log('\n✅ Compound index already exists');
    }

    console.log('\n✅ Index cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

forceDropEmailIndex();
