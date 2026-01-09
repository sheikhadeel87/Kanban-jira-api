import Task from '../models/task.model.js';
import Board from '../models/board.model.js';
import Workspace from '../models/workspace.model.js';

/**
 * Get all tasks for a board (only board members can view)
 */
export const getTasksByBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId).populate('workspace');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    // Check if user is workspace member
    const workspace = await Workspace.findById(board.workspace._id || board.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isWorkspaceMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const tasks = await Task.find({ board: req.params.boardId })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ order: 1, createdAt: 1 });

    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
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

    // Check if user is workspace member
    const boardDoc = await Board.findById(board).populate('workspace');
    if (!boardDoc) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const workspace = await Workspace.findById(boardDoc.workspace._id || boardDoc.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isWorkspaceMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'You must be a workspace member to create tasks' });
    }

    // Validate assigned users are workspace members
    if (assignedTo && Array.isArray(assignedTo)) {
      const workspaceMemberIds = workspace.members.map((m) => m.user.toString());
      const invalidUsers = assignedTo.filter((userId) => 
        !workspaceMemberIds.includes(userId.toString())
      );
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          msg: 'All assigned users must be workspace members' 
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
      attachment: req.file ? req.file.filename : null,
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

    // Check workspace membership
    const currentBoard = await Board.findById(task.board._id || task.board).populate('workspace');
    if (!currentBoard) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const workspace = await Workspace.findById(currentBoard.workspace._id || currentBoard.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isWorkspaceMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check if only board is being changed (moving task between boards)
    const isOnlyBoardChange = newBoardId !== undefined && 
      newBoardId !== (task.board._id || task.board).toString() &&
      title === undefined && 
      description === undefined && 
      status === undefined && 
      assignedTo === undefined;

    // If only moving between boards, any workspace member can do it
    if (isOnlyBoardChange) {
      // Already checked workspace membership above, so allow it
    } else {
      // For other updates, check stricter authorization
      const isWorkspaceAdmin = workspace.members.some(
        (m) => m.user.toString() === req.user.id && m.role === 'admin'
      );

      const isAssigned = task.assignedTo.some(
        (userId) => userId.toString() === req.user.id
      );

      const isAuthorized =
        req.user.role === 'admin' ||
        task.createdBy.toString() === req.user.id ||
        isWorkspaceAdmin ||
        isAssigned;

      if (!isAuthorized) {
        return res.status(403).json({ msg: 'Not authorized' });
      }
    }

    // If board is being changed, validate new board is in same workspace
    if (newBoardId !== undefined && newBoardId !== (task.board._id || task.board).toString()) {
      const newBoard = await Board.findById(newBoardId).populate('workspace');
      if (!newBoard) {
        return res.status(404).json({ msg: 'New board not found' });
      }
      
      const newWorkspace = await Workspace.findById(newBoard.workspace._id || newBoard.workspace);
      if (!newWorkspace) {
        return res.status(404).json({ msg: 'New workspace not found' });
      }
      
      // Ensure new board is in the same workspace
      const newWorkspaceId = (newWorkspace._id || newWorkspace).toString();
      const currentWorkspaceId = (workspace._id || workspace).toString();
      
      if (newWorkspaceId !== currentWorkspaceId) {
        return res.status(400).json({ 
          msg: 'Cannot move task to a board in a different workspace' 
        });
      }
    }

    // Validate assigned users are workspace members
    if (assignedTo !== undefined && Array.isArray(assignedTo)) {
      const workspaceMemberIds = workspace.members.map((m) => m.user.toString());
      const invalidUsers = assignedTo.filter((userId) => 
        !workspaceMemberIds.includes(userId.toString())
      );
      
      if (invalidUsers.length > 0) {
        return res.status(400).json({ 
          msg: 'All assigned users must be workspace members' 
        });
      }
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (newBoardId !== undefined) updateData.board = newBoardId;
    if (req.file) {
      updateData.attachment = req.file.filename;
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
 * Update task status (task creator, assigned user, workspace member, or admin)
 */
export const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    let task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check workspace membership
    const board = await Board.findById(task.board._id || task.board).populate('workspace');
    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const workspace = await Workspace.findById(board.workspace._id || board.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isWorkspaceMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Any workspace member can update task status
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
    res.status(500).send('Server error');
  }
};

/**
 * Delete task (only task creator, workspace admin, or app admin)
 */
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Check workspace membership
    const board = await Board.findById(task.board._id || task.board).populate('workspace');
    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    const workspace = await Workspace.findById(board.workspace._id || board.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isWorkspaceMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isWorkspaceMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Only creator, workspace admin, or app admin can delete
    const isWorkspaceAdmin = workspace.members.some(
      (m) => m.user.toString() === req.user.id && m.role === 'admin'
    );

    const isAuthorized =
      req.user.role === 'admin' ||
      task.createdBy.toString() === req.user.id ||
      isWorkspaceAdmin;

    if (!isAuthorized) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Task removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
