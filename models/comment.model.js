import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500,
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        },
    mentions: [
        {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
    ],
},{timestamps: true,

});

commentSchema.index({ task: 1 });
commentSchema.index({ author: 1 });
commentSchema.index({ createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

export default Comment;