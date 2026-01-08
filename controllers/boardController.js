import Board from '../models/board.model.js';
import Workspace from '../models/workspace.model.js';

/**
 * Get boards by workspace (only workspace members can view)
 */
export const getBoardsByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Check if user is workspace member
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const boards = await Board.find({ workspace: workspaceId })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('workspace', 'name')
      .sort({ createdAt: 1 });

    res.json(boards);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Get all boards user has access to (across all workspaces)
 */
export const getBoards = async (req, res) => {
  try {
    // Get all workspaces user is member of
    const workspaces = await Workspace.find({
      'members.user': req.user.id,
    });

    const workspaceIds = workspaces.map((w) => w._id);

    const boards = await Board.find({
      workspace: { $in: workspaceIds },
      $or: [{ owner: req.user.id }, { members: req.user.id }],
    })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('workspace', 'name')
      .sort({ createdAt: 1 });

    res.json(boards);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('workspace', 'name');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    // Check if user is workspace member
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const createBoard = async (req, res) => {
  try {
    const { title, description, workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ msg: 'Workspace ID is required' });
    }

    // Check if user is workspace member
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    const isMember = workspace.members.some(
      (m) => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'You must be a workspace member to create boards' });
    }

    const newBoard = new Board({
      title,
      description,
      workspace: workspaceId,
      owner: req.user.id,
      members: [req.user.id],
    });

    const board = await newBoard.save();
    await board.populate('owner', 'name email');
    await board.populate('members', 'name email');
    await board.populate('workspace', 'name');

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const updateBoard = async (req, res) => {
  try {
    const { title, description, members } = req.body;

    let board = await Board.findById(req.params.id).populate('workspace');

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

    // Only owner or workspace admin can update
    const isWorkspaceAdmin = workspace.members.some(
      (m) => m.user.toString() === req.user.id && m.role === 'admin'
    );

    if (board.owner.toString() !== req.user.id && !isWorkspaceAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate members are workspace members
    if (members && Array.isArray(members)) {
      const workspaceMemberIds = workspace.members.map((m) => m.user.toString());
      const invalidMembers = members.filter((m) => !workspaceMemberIds.includes(m.toString()));
      
      if (invalidMembers.length > 0) {
        return res.status(400).json({ 
          msg: 'All board members must be workspace members' 
        });
      }
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (members !== undefined) updateData.members = members;

    board = await Board.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    )
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('workspace', 'name');

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

export const deleteBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id).populate('workspace');

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

    // Only owner or workspace admin can delete
    const isWorkspaceAdmin = workspace.members.some(
      (m) => m.user.toString() === req.user.id && m.role === 'admin'
    );

    if (board.owner.toString() !== req.user.id && !isWorkspaceAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await Board.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Board removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


