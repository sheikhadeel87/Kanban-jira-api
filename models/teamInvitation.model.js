import mongoose from 'mongoose';

const teamInvitationSchema = new mongoose.Schema({
  invitingMember: {
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
  invitedAt: {
    type: Date,
    default: Date.now,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Index for faster queries
teamInvitationSchema.index({ invitingMember: 1 });
teamInvitationSchema.index({ invitedEmail: 1 });
teamInvitationSchema.index({ memberId: 1 });
teamInvitationSchema.index({ status: 1 });

// Compound index for unique invitations per email per inviter
teamInvitationSchema.index({ invitingMember: 1, invitedEmail: 1 }, { unique: true });

const TeamInvitation = mongoose.model('TeamInvitation', teamInvitationSchema);
export default TeamInvitation;

