import Task from '../models/task.model.js';
import Board from '../models/board.model.js';
import Project from '../models/project.model.js';
import Organization from '../models/organization.model.js';
import User from '../models/user.model.js';
import { canCreateTask, canUpdateTask, canDeleteTask, isMember } from '../utils/permissions.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

/**
 * Get all tasks for a board (only board members can view)
 */
export const getTasksByBoard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const board = await Board.findById(req.params.boardId).populate('project');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    // Check if user is project member
    const project = await Project.findById(board.project._id || board.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check user belongs to same organization
    if (project.organization.toString() !== user.organization.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const isProjectMember = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id
    );

    if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const tasks = await Task.find({ board: req.params.boardId })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ order: 1, createdAt: 1 });

    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Create task (only workspace members can create)
 */
export const createTask = async (req, res) => {
  try {
    // Handle both JSON and FormData
    let { title, description, status, board, assignedTo } = req.body;

    // Ensure assignedTo is an array
    if (assignedTo && !Array.isArray(assignedTo)) {
      assignedTo = [assignedTo];
    }

    if (!board) {
      return res.status(400).json({ msg: 'Board ID is required' });
    }

    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Check if user is project member
    const boardDoc = await Board.findById(board).populate('project');
    if (!boardDoc) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const project = await Project.findById(boardDoc.project._id || boardDoc.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const organization = await Organization.findById(organizationId).populate('owner', '_id');
    
    if (!organization) {
      return res.status(404).json({ msg: 'Organization not found' });
    }

    // Check user belongs to same organization
    const projectOrgId = project.organization._id || project.organization;
    if (projectOrgId.toString() !== organizationId.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check permissions: all members can create tasks
    const canCreate = canCreateTask(user, organization);
    console.log('Checking task creation permissions:', {
      userId: user._id.toString(),
      userRole: user.role,
      orgOwner: organization.owner?._id?.toString() || organization.owner?.toString(),
      isMember: isMember(user, organization),
      canCreate: canCreate
    });
    
    if (!canCreate) {
      return res.status(403).json({ msg: 'You must be an organization member to create tasks' });
    }

    // Validate assigned users are project members (and in same org)
    if (assignedTo && Array.isArray(assignedTo)) {
      const projectMemberIds = project.members.map((m) => (m.user._id || m.user).toString());
      const invalidUsers = assignedTo.filter((userId) => 
        !projectMemberIds.includes(userId.toString())
      );
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          msg: 'All assigned users must be project members' 
        });
      }
    }

    const newTask = new Task({
      title,
      description,
      status: status || 'todo',
      board,
      assignedTo: assignedTo || [],
      createdBy: req.user.id,
      // Store Cloudinary URL (secure_url or path)
      attachment: req.file ? (req.file.secure_url || req.file.path) : null,
    });

    const task = await newTask.save();
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Update task (task creator, assigned user, workspace admin, or app admin)
 */
export const updateTask = async (req, res) => {
  try {
    // Handle both JSON and FormData
    let { title, description, status, assignedTo, board: newBoardId } = req.body;

    // Ensure assignedTo is an array if provided
    if (assignedTo !== undefined && !Array.isArray(assignedTo)) {
      assignedTo = assignedTo ? [assignedTo] : [];
    }

    let task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Check project membership
    const currentBoard = await Board.findById(task.board._id || task.board).populate('project');
    if (!currentBoard) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const project = await Project.findById(currentBoard.project._id || currentBoard.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const organization = await Organization.findById(organizationId).populate('owner', '_id');
    
    if (!organization) {
      return res.status(404).json({ msg: 'Organization not found' });
    }

    // Check user belongs to same organization
    const projectOrgId = project.organization._id || project.organization;
    if (projectOrgId.toString() !== organizationId.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check if user is project member
    const isProjectMember = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id
    );

    // Check if only board is being changed (moving task between boards)
    const isOnlyBoardChange = newBoardId !== undefined && 
      newBoardId !== (task.board._id || task.board).toString() &&
      title === undefined && 
      description === undefined && 
      status === undefined && 
      assignedTo === undefined;

    // Check if only status is being changed (drag and drop)
    const isOnlyStatusChange = status !== undefined && 
      status !== task.status &&
      title === undefined && 
      description === undefined && 
      assignedTo === undefined &&
      newBoardId === undefined;

    // If only moving between boards or updating status, any project member can do it
    if (isOnlyBoardChange || isOnlyStatusChange) {
      // Allow if user is project member or org admin/owner
      if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
        return res.status(403).json({ msg: 'You must be a project member to move tasks' });
      }
    } else {
      // For other updates (title, description, assignedTo), check permissions
      if (!canUpdateTask(user, organization, task)) {
        console.log('Task update permission check failed:', {
          userId: user._id.toString(),
          userRole: user.role,
          isProjectMember,
          isAssigned: task.assignedTo?.some((userId) => userId.toString() === user._id.toString()),
          canUpdate: canUpdateTask(user, organization, task)
        });
        return res.status(403).json({ msg: 'Not authorized to update this task' });
      }
    }

    // If board is being changed, validate new board is in same project
    if (newBoardId !== undefined && newBoardId !== (task.board._id || task.board).toString()) {
      const newBoard = await Board.findById(newBoardId).populate('project');
      if (!newBoard) {
        return res.status(404).json({ msg: 'New board not found' });
      }
      
      const newProject = await Project.findById(newBoard.project._id || newBoard.project);
      if (!newProject) {
        return res.status(404).json({ msg: 'New project not found' });
      }
      
      // Ensure new board is in the same project
      const newProjectId = (newProject._id || newProject).toString();
      const currentProjectId = (project._id || project).toString();
      
      if (newProjectId !== currentProjectId) {
        return res.status(400).json({ 
          msg: 'Cannot move task to a board in a different project' 
        });
      }
    }

    // Validate assigned users are project members (and in same org)
    if (assignedTo !== undefined && Array.isArray(assignedTo)) {
      const projectMemberIds = project.members.map((m) => (m.user._id || m.user).toString());
      const invalidUsers = assignedTo.filter((userId) => 
        !projectMemberIds.includes(userId.toString())
      );
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          msg: 'All assigned users must be project members' 
        });
      }
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (newBoardId !== undefined) updateData.board = newBoardId;
    
    // Handle file upload/update
    if (req.file) {
      // Delete old file from Cloudinary if it exists
      if (task.attachment) {
        try {
          await deleteFromCloudinary(task.attachment);
        } catch (error) {
          console.error('Error deleting old file from Cloudinary:', error);
          // Continue even if deletion fails
        }
      }
      // Store new Cloudinary URL
      updateData.attachment = req.file.secure_url || req.file.path;
    } else if (req.body.attachment === null || req.body.attachment === '') {
      // Handle explicit attachment removal
      if (task.attachment) {
        try {
          await deleteFromCloudinary(task.attachment);
        } catch (error) {
          console.error('Error deleting file from Cloudinary:', error);
          // Continue even if deletion fails
        }
      }
      updateData.attachment = null;
    }

    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    )
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Update task status (any project member can update status)
 */
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findById(req.user.id);

    let task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check project membership
    const board = await Board.findById(task.board._id || task.board).populate('project');
    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const project = await Project.findById(board.project._id || board.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check user belongs to same organization
    if (project.organization.toString() !== user.organization.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const isProjectMember = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id
    );

    if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Any project member can update task status
    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    )
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Delete task (only admin/owner can delete)
 */
export const deleteTask = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    const task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check project membership
    const board = await Board.findById(task.board._id || task.board).populate('project');
    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const project = await Project.findById(board.project._id || board.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check user belongs to same organization
    if (project.organization.toString() !== user.organization.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check permissions: only admin/owner can delete
    if (!canDeleteTask(user, organization)) {
      return res.status(403).json({ msg: 'Only admin/owner can delete tasks' });
    }

    // Delete attachment from Cloudinary if it exists
    if (task.attachment) {
      try {
        await deleteFromCloudinary(task.attachment);
      } catch (error) {
        console.error('Error deleting file from Cloudinary:', error);
        // Continue with task deletion even if file deletion fails
      }
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Task removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
