import mongoose from 'mongoose';

const pushTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    platform: {
        type: String,
        enum: ['android', 'ios', 'web'],
        default: 'web',
    },
    lastSeen: {
        type: Date,
        default: Date.now,
    },
},{
    timestamps: true,
}
)

const PushToken = mongoose.model('PushToken', pushTokenSchema);

export default PushToken;