import Workspace from '../models/workspace.model.js';
import Board from '../models/board.model.js';

/**
 * Get all workspaces where user is a member
 */
export const getWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      'members.user': req.user.id,
    })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });

    res.json(workspaces);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Get workspace by ID (only members can view)
 */
export const getWorkspaceById = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email');

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is a member
    const isMember = workspace.members.some(
      (m) => m.user._id.toString() === req.user.id
    );

    if (!isMember && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Create workspace (creator becomes admin)
 */
export const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;

    const workspace = new Workspace({
      name,
      description,
      createdBy: req.user.id,
      members: [
        {
          user: req.user.id,
          role: 'admin',
        },
      ],
    });

    await workspace.save();
    await workspace.populate('createdBy', 'name email');
    await workspace.populate('members.user', 'name email');

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Update workspace (only workspace admin or app admin)
 */
export const updateWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is workspace admin or app admin
    const member = workspace.members.find(
      (m) => m.user.toString() === req.user.id
    );

    if (
      (!member || member.role !== 'admin') &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    workspace.name = name || workspace.name;
    workspace.description = description || workspace.description;

    await workspace.save();
    await workspace.populate('createdBy', 'name email');
    await workspace.populate('members.user', 'name email');

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Delete workspace (only workspace admin or app admin)
 */
export const deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is workspace admin or app admin
    const member = workspace.members.find(
      (m) => m.user.toString() === req.user.id
    );

    if (
      (!member || member.role !== 'admin') &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Delete all boards in this workspace
    await Board.deleteMany({ workspace: workspace._id });

    await Workspace.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Workspace removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Add member to workspace (only workspace admin)
 */
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is workspace admin
    const member = workspace.members.find(
      (m) => m.user.toString() === req.user.id
    );

    if (
      (!member || member.role !== 'admin') &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Check if user is already a member
    if (workspace.members.some((m) => m.user.toString() === userId)) {
      return res.status(400).json({ msg: 'User already in workspace' });
    }

    workspace.members.push({
      user: userId,
      role: 'member',
    });

    await workspace.save();
    await workspace.populate('members.user', 'name email');

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Remove member from workspace (only workspace admin)
 */
export const removeMember = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is workspace admin
    const member = workspace.members.find(
      (m) => m.user.toString() === req.user.id
    );

    if (
      (!member || member.role !== 'admin') &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Don't allow removing the creator
    if (workspace.createdBy.toString() === req.params.userId) {
      return res.status(400).json({ msg: 'Cannot remove workspace creator' });
    }

    workspace.members = workspace.members.filter(
      (m) => m.user.toString() !== req.params.userId
    );

    await workspace.save();
    await workspace.populate('members.user', 'name email');

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/**
 * Update member role (only workspace admin)
 */
export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;

    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) {
      return res.status(404).json({ msg: 'Workspace not found' });
    }

    // Check if user is workspace admin
    const member = workspace.members.find(
      (m) => m.user.toString() === req.user.id
    );

    if (
      (!member || member.role !== 'admin') &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Don't allow changing creator's role
    if (workspace.createdBy.toString() === req.params.userId) {
      return res.status(400).json({ msg: 'Cannot change workspace creator role' });
    }

    const memberToUpdate = workspace.members.find(
      (m) => m.user.toString() === req.params.userId
    );

    if (!memberToUpdate) {
      return res.status(404).json({ msg: 'Member not found' });
    }

    memberToUpdate.role = role;

    await workspace.save();
    await workspace.populate('members.user', 'name email');

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

