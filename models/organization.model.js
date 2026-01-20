import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Will be set after user creation during registration
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
organizationSchema.index({ owner: 1 });

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
