import mongoose from "mongoose";

const teamSchema = new mongoose.Schema({
    inviting_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    member_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    invitedEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
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
    invitationToken: {
        type: String,
        required: true,
        unique: true,
    },
    tokenExpiresAt: {
        type: Date,
        default: function() {
            // Token expires in 7 days
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        },
    },
}, {
    timestamps: true,
    collection: 'teams', // Explicitly set collection name to 'teams'
});

// Indexes for faster queries
teamSchema.index({ inviting_id: 1 });
teamSchema.index({ member_id: 1 });
teamSchema.index({ invitedEmail: 1 });
teamSchema.index({ status: 1 });
teamSchema.index({ invitationToken: 1 }); // Index for token lookup

// Compound index to prevent duplicate invitations per email per inviter
teamSchema.index({ inviting_id: 1, invitedEmail: 1 }, { unique: true });

const Team = mongoose.model('Team', teamSchema);
export default Team;
