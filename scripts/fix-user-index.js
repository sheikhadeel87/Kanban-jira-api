import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Kanban-Trello';

async function fixUserIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get all indexes
    const indexes = await usersCollection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, idx.key, idx.unique ? '(unique)' : '');
    });

    // Find and drop any old unique index on just email (not compound)
    // Check both by name and by key pattern
    const oldEmailIndexes = indexes.filter(idx => {
      const keys = Object.keys(idx.key || {});
      // Check if it's a single-field index on email (unique or not)
      const isSingleEmailIndex = keys.length === 1 && keys[0] === 'email';
      // Also check if name suggests it's an email-only index
      const isEmailNamedIndex = idx.name && (idx.name === 'email_1' || idx.name.startsWith('email_'));
      return isSingleEmailIndex || (isEmailNamedIndex && keys.length === 1);
    });
    
    if (oldEmailIndexes.length > 0) {
      console.log('\n⚠️  Found old index(es) on email field. Dropping...');
      for (const oldIndex of oldEmailIndexes) {
        try {
          console.log(`  Attempting to drop: ${oldIndex.name} (${JSON.stringify(oldIndex.key)})`);
          await usersCollection.dropIndex(oldIndex.name);
          console.log(`✅ Dropped index: ${oldIndex.name}`);
        } catch (dropErr) {
          // Try alternative method if name doesn't work
          try {
            console.log(`  Trying to drop using key pattern: { email: 1 }`);
            await usersCollection.dropIndex({ email: 1 });
            console.log(`✅ Dropped index using key pattern: { email: 1 }`);
          } catch (err2) {
            console.error(`❌ Failed to drop index ${oldIndex.name}:`, err2.message);
            // Last resort: try to drop by exact key pattern
            if (err2.code !== 27) { // 27 = IndexNotFound
              console.log(`  Attempting force drop...`);
              try {
                await db.command({ dropIndexes: 'users', index: oldIndex.name });
                console.log(`✅ Force dropped: ${oldIndex.name}`);
              } catch (err3) {
                console.error(`❌ Force drop also failed:`, err3.message);
              }
            }
          }
        }
      }
    } else {
      console.log('\n✅ No old unique email index found by pattern matching');
      
      // Double-check: try to drop email_1 index directly (in case it exists but wasn't listed)
      try {
        await usersCollection.dropIndex('email_1');
        console.log('✅ Dropped hidden email_1 index');
      } catch (notFoundErr) {
        if (notFoundErr.code === 27 || notFoundErr.codeName === 'IndexNotFound') {
          console.log('✅ Confirmed: email_1 index does not exist');
        } else {
          console.log('⚠️  Could not verify email_1 index:', notFoundErr.message);
        }
      }
    }

    // Refresh indexes after dropping
    const updatedIndexes = await usersCollection.indexes();
    
    // Ensure compound index exists
    const compoundIndex = updatedIndexes.find(
      idx => {
        const keys = Object.keys(idx.key || {});
        return keys.length === 2 && 
               keys.includes('email') && 
               keys.includes('organization') &&
               idx.key.email === 1 && 
               idx.key.organization === 1 &&
               idx.unique === true;
      }
    );

    if (!compoundIndex) {
      console.log('\n📝 Creating compound unique index on email + organization...');
      try {
        await usersCollection.createIndex(
          { email: 1, organization: 1 },
          { unique: true, name: 'email_1_organization_1' }
        );
        console.log('✅ Compound index created successfully');
      } catch (createErr) {
        if (createErr.code === 85) {
          // Index already exists with different name
          console.log('⚠️  Compound index might already exist with different name');
        } else {
          throw createErr;
        }
      }
    } else {
      console.log('\n✅ Compound index already exists:', compoundIndex.name);
    }

    // Verify final indexes
    const finalIndexes = await usersCollection.indexes();
    console.log('\nFinal indexes:', finalIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    console.log('\n✅ Index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
}

fixUserIndex();
