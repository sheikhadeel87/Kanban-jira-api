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
userSchema.index({ email: 1, organization: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
export default User;

