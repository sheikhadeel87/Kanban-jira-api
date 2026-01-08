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
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'completed'],
    default: 'todo',
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
}, {
  timestamps: true,
});

// Index for faster queries
taskSchema.index({ board: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
