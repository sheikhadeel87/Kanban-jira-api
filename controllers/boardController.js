import Board from '../models/board.model.js';
import Project from '../models/project.model.js';
import Organization from '../models/organization.model.js';
import User from '../models/user.model.js';
import { canCreateBoard, isAdminOrOwner } from '../utils/permissions.js';
import { sendBoardInvitation } from '../utils/emailService.js';

/**
 * Get boards by project (only project members can view)
 */
export const getBoardsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = await User.findById(req.user.id);

    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization IDs (handle both populated and non-populated cases)
    const userOrgId = user.organization._id || user.organization;
    const userIdStr = req.user.id.toString();

    console.log('=== GET BOARDS BY PROJECT ===');
    console.log('User:', {
      id: userIdStr,
      role: user.role,
      organizationId: userOrgId.toString()
    });
    console.log('Project ID:', projectId);

    // Check if user is project member - POPULATE members first!
    const project = await Project.findById(projectId)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .populate('organization', 'name');

    if (!project) {
      console.log('Project not found:', projectId);
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Get organization IDs (handle both populated and non-populated cases)
    const projectOrgId = project.organization._id || project.organization;

    // Check user belongs to same organization
    if (projectOrgId.toString() !== userOrgId.toString()) {
      console.log('Organization mismatch:', {
        userOrgId: userOrgId.toString(),
        projectOrgId: projectOrgId.toString()
      });
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check if user is project member (handle both populated and non-populated member.user)
    const isMember = project.members && project.members.some((m) => {
      if (!m || !m.user) return false;
      const memberUserId = m.user._id 
        ? m.user._id.toString() 
        : m.user.toString();
      const matches = memberUserId === userIdStr;
      if (matches) {
        console.log(`User ${userIdStr} is member of project with role ${m.role}`);
      }
      return matches;
    });

    // Also check if user is the project creator (handle both populated and non-populated)
    const createdById = project.createdBy?._id 
      ? project.createdBy._id.toString() 
      : project.createdBy?.toString() || project.createdBy.toString();
    const isCreator = createdById === userIdStr;

    if (isCreator) {
      console.log(`User ${userIdStr} is creator of project ${projectId}`);
    }

    // Allow access if: user is project member, creator, or org admin/owner
    if (!isMember && !isCreator && user.role !== 'owner' && user.role !== 'admin') {
      console.log('❌ Access denied for boards:', {
        userId: userIdStr,
        userRole: user.role,
        isMember,
        isCreator,
        projectName: project.name,
        projectMembers: project.members?.map(m => {
          const mid = m.user?._id 
            ? m.user._id.toString() 
            : m.user?.toString() || m.user.toString();
          return {
            userId: mid,
            role: m.role,
            matches: mid === userIdStr
          };
        }) || []
      });
      return res.status(403).json({ msg: 'Access denied. You must be a project member to view boards.' });
    }

    // If user is project member, creator, or org admin/owner, return ALL boards in the project
    const boards = await Board.find({ project: projectId })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: 1 });

    console.log('✅ Returning boards:', {
      userId: userIdStr,
      projectId,
      projectName: project.name,
      boardCount: boards.length,
      accessReason: (() => {
        if (user.role === 'owner' || user.role === 'admin') return 'org_admin';
        if (isCreator) return 'creator';
        if (isMember) return 'member';
        return 'none';
      })()
    });
    console.log('===========================');

    res.json(boards);
  } catch (err) {
    console.error('Error in getBoardsByProject:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Get all boards user has access to (across all projects)
 */
export const getBoards = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const userIdStr = req.user.id.toString();

    // Get all projects user is member of in their organization
    // Include projects where user is a member OR creator OR org admin/owner
    const projects = await Project.find({
      organization: organizationId,
      $or: [
        { 'members.user': req.user.id }, // User is explicitly a member
        { createdBy: req.user.id }, // User is the creator
      ],
    });

    // If user is org admin/owner, get all projects in the organization
    let allProjects = projects;
    if (user.role === 'owner' || user.role === 'admin') {
      const adminProjects = await Project.find({
        organization: organizationId,
      });
      // Merge and deduplicate
      const projectMap = new Map();
      [...projects, ...adminProjects].forEach(p => {
        projectMap.set(p._id.toString(), p);
      });
      allProjects = Array.from(projectMap.values());
    }

    const projectIds = allProjects.map((p) => p._id);

    if (projectIds.length === 0) {
      console.log('No projects found for user:', {
        userId: userIdStr,
        userRole: user.role,
        organizationId: organizationId.toString()
      });
      return res.json([]);
    }

    // Get all boards in those projects (project members can see all boards in their projects)
    const boards = await Board.find({
      project: { $in: projectIds },
    })
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: 1 });

    console.log('Boards found for user:', {
      userId: userIdStr,
      userRole: user.role,
      projectCount: projectIds.length,
      boardCount: boards.length
    });

    res.json(boards);
  } catch (err) {
    console.error('Error in getBoards:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

export const getBoardById = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const board = await Board.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members', 'name email')
      .populate('project', 'name');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    // Check if user is project member
    const project = await Project.findById(board.project);
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check user belongs to same organization
    if (project.organization.toString() !== user.organization.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const isMember = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id
    );

    if (!isMember && user.role !== 'owner' && user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const createBoard = async (req, res) => {
  try {
    const { title, description, projectId } = req.body;
    const user = await User.findById(req.user.id);

    if (!projectId) {
      return res.status(400).json({ msg: 'Project ID is required' });
    }

    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const organization = await Organization.findById(organizationId).populate('owner', '_id');
    const project = await Project.findById(projectId);
    
    if (!organization) {
      return res.status(404).json({ msg: 'Organization not found' });
    }
    
    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Check user belongs to same organization
    const projectOrgId = project.organization._id || project.organization;
    if (projectOrgId.toString() !== organizationId.toString()) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check permissions: admin/owner can create boards
    const canCreate = canCreateBoard(user, organization);
    console.log('Checking board creation permissions:', {
      userId: user._id.toString(),
      userRole: user.role,
      orgOwner: organization.owner?._id?.toString() || organization.owner?.toString(),
      orgOwnerType: typeof organization.owner,
      isOwner: organization.owner && (organization.owner._id?.toString() === user._id.toString() || organization.owner.toString() === user._id.toString()),
      canCreate: canCreate
    });
    
    if (!canCreate) {
      return res.status(403).json({ 
        msg: 'Only admin/owner can create boards'
      });
    }

    const newBoard = new Board({
      title,
      description,
      project: projectId,
      owner: req.user.id,
      members: [req.user.id],
    });

    const board = await newBoard.save();
    await board.populate('owner', 'name email');
    await board.populate('members', 'name email');
    await board.populate('project', 'name');

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const updateBoard = async (req, res) => {
  try {
    const { title, description, members } = req.body;
    const user = await User.findById(req.user.id).populate('organization');

    let board = await Board.findById(req.params.id).populate('project');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);
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

    // Only owner or project admin or org admin/owner can update
    const isProjectAdmin = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id && m.role === 'admin'
    );

    if (board.owner.toString() !== req.user.id && !isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate members are project members (and in same org)
    if (members && Array.isArray(members)) {
      const projectMemberIds = project.members.map((m) => (m.user._id || m.user).toString());
      const invalidMembers = members.filter((m) => !projectMemberIds.includes(m.toString()));
      
      if (invalidMembers.length > 0) {
        return res.status(400).json({ 
          msg: 'All board members must be project members' 
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
      .populate('project', 'name');

    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const deleteBoard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    const board = await Board.findById(req.params.id).populate('project');

    if (!board) {
      return res.status(404).json({ msg: 'Board not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);
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

    // Only owner or project admin or org admin/owner can delete
    const isProjectAdmin = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id && m.role === 'admin'
    );

    if (board.owner.toString() !== req.user.id && !isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    await Board.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Board removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Send board invitation via email
 */
export const sendBoardInvite = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { userId } = req.body;

    const user = await User.findById(req.user.id);
    
    // Get board with populated data
    const board = await Board.findById(boardId)
      .populate('owner', 'name email')
      .populate('project', 'name');

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

    // Get invited user
    const invitedUser = await User.findById(userId);
    if (!invitedUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if user is already a board member
    const isAlreadyMember = board.members.some(
      (member) => (member._id || member).toString() === userId
    );

    if (isAlreadyMember) {
      return res.status(400).json({ msg: 'User is already a member of this board' });
    }

    // Get inviter info
    const inviter = await User.findById(req.user.id);
    const inviterName = inviter?.name || 'Someone';

    // Construct board URL (adjust based on your frontend URL)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const boardUrl = `${frontendUrl}/board/${boardId}`;

    // Send invitation email
    const emailResult = await sendBoardInvitation(
      invitedUser.email,
      invitedUser.name || 'User',
      inviterName,
      board.title,
      project.name,
      boardUrl
    );

    // Add user to board members
    board.members.push(userId);
    await board.save();

    res.json({
      msg: 'Invitation sent successfully',
      emailSent: emailResult.success,
      board: await Board.findById(boardId)
        .populate('owner', 'name email')
        .populate('members', 'name email')
        .populate('project', 'name'),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};


