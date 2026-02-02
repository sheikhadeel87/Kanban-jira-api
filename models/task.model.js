import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true,
  },
  assignedTo: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  attachment: {
    type: String,
  },
  order: {
    type: Number,
    default: 0,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  dueDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
taskSchema.index({ board: 1 }); // For fetching tasks by board
taskSchema.index({ board: 1, createdAt: -1 }); // Compound index for board + sorting
taskSchema.index({ assignedTo: 1 }); // For user's assigned tasks
taskSchema.index({ createdBy: 1 }); // For tasks created by user

const Task = mongoose.model('Task', taskSchema);
export default Task;
