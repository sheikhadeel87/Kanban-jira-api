import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Task from '../models/task.model.js';
import User from '../models/user.model.js';
import Board from '../models/board.model.js';
import Project from '../models/project.model.js';
import Organization from '../models/organization.model.js';

// Get all comments for a task
export const getCommentsByTask = async (req, res) => {
    try {
      const { taskId } = req.params;
      const user = await User.findById(req.user.id);
      
      if (!user || !user.organization) {
        return res.status(404).json({ msg: 'User does not belong to an organization' });
      }
  
      // Verify task exists and user has access
      const task = await Task.findById(taskId).populate('board');
      if (!task) {
        return res.status(404).json({ msg: 'Task not found' });
      }
  
      const board = await Board.findById(task.board._id || task.board).populate('project');
      if (!board) {
        return res.status(404).json({ msg: 'Board not found' });
      }
  
      const project = await Project.findById(board.project._id || board.project);
      if (!project) {
        return res.status(404).json({ msg: 'Project not found' });
      }

// Check user belongs to same organization
const organizationId = user.organization._id || user.organization;
const projectOrgId = project.organization._id || project.organization;
if (projectOrgId.toString() !== organizationId.toString()) {
  return res.status(403).json({ msg: 'Access denied' });
}

// Check if user is project member
const isProjectMember = project.members.some(
    (m) => (m.user._id || m.user).toString() === req.user.id
  );

  if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied' });
  }

  // Get comments
  const comments = await Comment.find({ task: taskId })
  .populate('author', 'name email')
  .sort({ createdAt: -1 });

res.json(comments);
} catch (err) {
console.error(err.message);
res.status(500).json({ msg: 'Server error' });
}
};

// Extract mentioned user IDs from comment text
export const extractMentionedUserIds = (text = "") => {
  const ids = new Set();
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (mongoose.Types.ObjectId.isValid(m[1])) ids.add(m[1]);
  }
  return Array.from(ids);
}

 // Create a new comment
export const createComment = async (req, res) => {
    try {
      const { taskId } = req.params;
      const { text } = req.body;
  
      if (!text || !text.trim()) {
        return res.status(400).json({ msg: 'Comment text is required' });
      }
  
      const user = await User.findById(req.user.id);
      
      if (!user || !user.organization) {
        return res.status(404).json({ msg: 'User does not belong to an organization' });
      }
  
      // Verify task exists and user has access
      const task = await Task.findById(taskId).populate('board');
      if (!task) {
        return res.status(404).json({ msg: 'Task not found' });
      }
  
      const board = await Board.findById(task.board._id || task.board).populate('project');
      if (!board) {
        return res.status(404).json({ msg: 'Board not found' });
      }
  
      const project = await Project.findById(board.project._id || board.project);
      if (!project) {
        return res.status(404).json({ msg: 'Project not found' });
      }

// Check user belongs to same organization
const organizationId = user.organization._id || user.organization;
const organization = await Organization.findById(organizationId);
if (!organization) {
  return res.status(404).json({ msg: 'Organization not found' });
}

const projectOrgId = project.organization._id || project.organization;
if (projectOrgId.toString() !== organizationId.toString()) {
  return res.status(403).json({ msg: 'Access denied' });
}

// Check if user is project member (any project member can comment)
const isProjectMember = project.members.some(
    (m) => (m.user._id || m.user).toString() === req.user.id
  );

  if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ msg: 'You must be a project member to comment' });
  }
     


    // Create comment
    const mentionedUserIds = extractMentionedUserIds(text.trim());
    const comment = new Comment({
        text: text.trim(),
        task: taskId,
        author: req.user.id,
        mentions: mentionedUserIds,
      });
  
      await comment.save();
      await comment.populate('author', 'name email');
  
      res.status(201).json(comment);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };

  // Update a comment (only author can update)
export const updateComment = async (req, res) => {
    try {
      const { commentId } = req.params;
      const { text } = req.body;
  
      if (!text || !text.trim()) {
        return res.status(400).json({ msg: 'Comment text is required' });
      }
  
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ msg: 'Comment not found' });
      }
  
      // Only author can update
      if (comment.author.toString() !== req.user.id) {
        return res.status(403).json({ msg: 'Not authorized to update this comment' });
      }
  
      comment.text = text.trim();
      await comment.save();
      await comment.populate('author', 'name email');
  
      res.json(comment);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Server error' });
    }
  };

  // Delete a comment (author, admin, or owner can delete)
export const deleteComment = async (req, res) => {
    try {
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) {
        return res.status(404).json({ msg: 'Comment not found' });
      }
  
      const user = await User.findById(req.user.id);
      if (!user || !user.organization) {
        return res.status(404).json({ msg: 'User does not belong to an organization' });
      }
  
      const organization = await Organization.findById(user.organization._id || user.organization).populate('owner', '_id');
      if (!organization) {
        return res.status(404).json({ msg: 'Organization not found' });
      }
      
   // Check if user is author, admin, or owner
   const isAuthor = comment.author.toString() === req.user.id;
   const isAdminOrOwner = user.role === 'admin' || 
     (organization.owner && (
       organization.owner._id?.toString() === user._id.toString() ||
       organization.owner.toString() === user._id.toString()
     ));

   if (!isAuthor && !isAdminOrOwner) {
     return res.status(403).json({ msg: 'Not authorized to delete this comment' });
   }

   await Comment.findByIdAndDelete(req.params.commentId);
   res.json({ msg: 'Comment deleted' });
 } catch (err) {
   console.error(err.message);
   res.status(500).json({ msg: 'Server error' });
 }
};