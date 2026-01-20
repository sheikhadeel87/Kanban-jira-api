import mongoose from 'mongoose';
import crypto from 'crypto';

const organizationInvitationSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invitedEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['invited', 'accepted', 'declined'],
    default: 'invited',
  },
  invitationToken: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
  },
  tokenExpiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    },
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
organizationInvitationSchema.index({ organization: 1 });
organizationInvitationSchema.index({ invitedEmail: 1 });
organizationInvitationSchema.index({ invitationToken: 1 });
organizationInvitationSchema.index({ organization: 1, invitedEmail: 1 }, { unique: true });

const OrganizationInvitation = mongoose.model('OrganizationInvitation', organizationInvitationSchema);
export default OrganizationInvitation;
