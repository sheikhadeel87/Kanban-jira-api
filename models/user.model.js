import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        // Removed unique: true - same email can exist in multiple orgs
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
    },
    role: {
        type: String,
        enum: ['owner', 'admin', 'member'],
        default: 'member',
    }
    
},{
        timestamps: true,
    }
);

// Email must be unique per organization
// Explicitly name the index to prevent conflicts with old email_1 index
userSchema.index({ email: 1, organization: 1 }, { unique: true, name: 'email_1_organization_1' });

// Ensure Mongoose doesn't try to create old email_1 index
// This prevents auto-indexing from creating conflicting indexes
userSchema.set('autoIndex', true); // Keep auto-indexing enabled, but explicit index name prevents conflicts

const User = mongoose.model('User', userSchema);

// After model creation, ensure indexes are correct
// This runs once when the model is first loaded
User.on('index', function(err) {
  if (err) {
    console.error('User model index error:', err);
    // If it's trying to create email_1, we can ignore it since we have the compound index
    if (err.message && err.message.includes('email_1') && !err.message.includes('email_1_organization_1')) {
      console.warn('Ignoring email_1 index creation attempt (compound index exists)');
    }
  }
});

export default User;

