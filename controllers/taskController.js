import Task from '../models/task.model.js';
import Board from '../models/board.model.js';
import Project from '../models/project.model.js';
import Organization from '../models/organization.model.js';
import User from '../models/user.model.js';
import { canCreateTask, canUpdateTask, canDeleteTask, isMember } from '../utils/permissions.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { sendPushToUser } from '../utils/pushService.js'

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
    let { title, description, comments, board, assignedTo, priority, dueDate,  } = req.body;

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
      comments: comments || '',
      // status: status || 'todo',
      board,
      assignedTo: assignedTo || [],
      createdBy: req.user.id,
      priority: priority || 'medium',
      dueDate: dueDate || null,
      // Store Cloudinary URL (secure_url or path)
      attachment: req.file ? (req.file.secure_url || req.file.path) : null,
    });

    const task = await newTask.save();
    await task.populate('assignedTo', 'name email');
    await task.populate('createdBy', 'name email');

   // ✅ PUSH: notify assignees on task creation
try {
  const creatorId = String(req.user.id);
  const assignees = (task.assignedTo || []).map((u) => String(u._id || u));
  const notifyUsers = assignees.filter((id) => id !== creatorId);

  await Promise.all(
    notifyUsers.map((uid) =>
      sendPushToUser({
        userId: uid,
        title: "Task Assigned",
        body: `You were assigned: ${task.title}`,
        link: `/boards/${task.board}?task=${task._id}`,
        data: {
          type: "TASK_ASSIGNED",
          taskId: String(task._id),
          boardId: String(task.board),
        },
      })
    )
  );
} catch (pushErr) {
  console.error("Push error (createTask):", pushErr?.message || pushErr);
}
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
    let { title, description, comments, assignedTo, board: newBoardId, priority, dueDate } = req.body;

    // Ensure assignedTo is an array if provided
    if (assignedTo !== undefined && !Array.isArray(assignedTo)) {
      assignedTo = assignedTo ? [assignedTo] : [];
    }

    // Populate task with assignedTo and createdBy
    let task = await Task.findById(req.params.id)
    .populate('board')
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email");;

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }
    // ✅ Save old assignees BEFORE update (for diff)
const oldAssigned = (task.assignedTo || []).map((u) => String(u._id || u));

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
      comments === undefined && 
      // status === undefined && 
      assignedTo === undefined;

    // Check if only comments are being changed
    const isOnlyCommentChange = comments !== undefined && 
      title === undefined && 
      description === undefined && 
      assignedTo === undefined &&
      newBoardId === undefined &&
      priority === undefined &&
      dueDate === undefined;

    // Check if only status is being changed (drag and drop)
    // const isOnlyStatusChange = status !== undefined && 
    //   status !== task.status &&
    //   title === undefined && 
    //   description === undefined && 
    //   comments === undefined && 
    //   assignedTo === undefined &&
    //   newBoardId === undefined;

    // If only moving between boards, updating status, or updating comments, any project member can do it
    if (isOnlyBoardChange || isOnlyCommentChange) {
      // Allow if user is project member or org admin/owner
      if (!isProjectMember && user.role !== 'owner' && user.role !== 'admin') {
        return res.status(403).json({ msg: 'You must be a project member to update this task' });
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
    if (comments !== undefined) updateData.comments = comments;
    // if (status !== undefined) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (newBoardId !== undefined) updateData.board = newBoardId;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate || null;  
    
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

    const boardId = String(task.board?._id || task.board);
    const newAssigned = (task.assignedTo || []).map((u) => String(u._id || u));
    const updaterId = String(req.user.id);

    // ✅ PUSH: notify newly assigned users + existing assignees when task content changed
    try {
      // 1) "Task Assigned" — only to newly added assignees
      if (assignedTo !== undefined) {
        const newlyAdded = newAssigned.filter((id) => !oldAssigned.includes(id));
        const notifyUsers = newlyAdded.filter((id) => id !== updaterId);

        console.log('Push (updateTask):', {
          assignedInBody: !!assignedTo,
          oldAssigned,
          newAssigned,
          newlyAdded,
          notifyUsers,
        });

        await Promise.all(
          notifyUsers.map((uid) =>
            sendPushToUser({
              userId: uid,
              title: "Task Assigned",
              body: `You were assigned: ${task.title}`,
              link: `/boards/${boardId}?task=${task._id}`,
              data: {
                type: "TASK_ASSIGNED",
                taskId: String(task._id),
                boardId,
              },
            })
          )
        );
      }

      // 2) Notify existing assignees: "Task status updated" when only board moved (drag), else "Task updated"
      const contentChanged = Object.keys(updateData).some((k) => k !== 'assignedTo');
      if (contentChanged && newAssigned.length > 0) {
        const existingAssignees = newAssigned.filter((id) => oldAssigned.includes(id));
        const notifyForUpdate = existingAssignees.filter((id) => id !== updaterId);

        const onlyBoardChange = Object.keys(updateData).filter((k) => k !== 'assignedTo').length === 1 && updateData.board !== undefined;

        await Promise.all(
          notifyForUpdate.map((uid) =>
            sendPushToUser({
              userId: uid,
              title: onlyBoardChange ? "Task status updated" : "Task updated",
              body: onlyBoardChange ? `"${task.title}" was moved` : `"${task.title}" was updated`,
              link: `/boards/${boardId}?task=${task._id}`,
              data: {
                type: onlyBoardChange ? "TASK_STATUS_UPDATED" : "TASK_UPDATED",
                taskId: String(task._id),
                boardId,
              },
            })
          )
        );
      }
    } catch (pushErr) {
      console.error("Push error (updateTask):", pushErr?.message || pushErr);
    }

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

    let task = await Task.findById(req.params.id).populate("board");

    if (!task) {
      return res.status(404).json({ msg: "Task not found" });
    }

    // Check project membership
    const board = await Board.findById(task.board._id || task.board).populate("project");
    if (!board) {
      return res.status(404).json({ msg: "Board not found" });
    }

    const project = await Project.findById(board.project._id || board.project);
    if (!project) {
      return res.status(404).json({ msg: "Project not found" });
    }

    // Check user belongs to same organization
    if (project.organization.toString() !== user.organization.toString()) {
      return res.status(403).json({ msg: "Access denied" });
    }

    const isProjectMember = project.members.some(
      (m) => (m.user._id || m.user).toString() === req.user.id
    );

    if (!isProjectMember && user.role !== "owner" && user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    // Any project member can update task status
    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    )
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    // ✅ PUSH: notify assignees that status changed (before res.json)
    try {
      const updaterId = String(req.user.id);
      const assignees = (task.assignedTo || []).map((u) => String(u._id || u));

      // optional: don't notify the person who moved it
      const notifyUsers = assignees.filter((id) => id !== updaterId);

      await Promise.all(
        notifyUsers.map((uid) =>
          sendPushToUser({
            userId: uid,
            title: "Task Status Updated",
            body: `"${task.title}" moved to ${status}`,
            link: `/boards/${task.board}?task=${task._id}`,
            data: {
              type: "STATUS_CHANGED",
              taskId: String(task._id),
              boardId: String(task.board),
              status: String(status),
            },
          })
        )
      );
    } catch (pushErr) {
      // don't fail the API if push fails
      console.error("Push error (status update):", pushErr?.message || pushErr);
    }

    return res.json(task);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: "Server error" });
  }
};

/**
 * Delete task (only admin/owner can delete)
 */
export const deleteTask = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const task = await Task.findById(req.params.id).populate('board');

    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
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

    // Check permissions: only admin/owner can delete
    const canDelete = canDeleteTask(user, organization);
    console.log('Checking task deletion permissions:', {
      userId: user._id.toString(),
      userRole: user.role,
      orgOwner: organization.owner?._id?.toString() || organization.owner?.toString(),
      isOwner: organization.owner && (
        (organization.owner._id?.toString() === user._id.toString()) ||
        (organization.owner.toString() === user._id.toString())
      ),
      canDelete: canDelete
    });
    
    if (!canDelete) {
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
