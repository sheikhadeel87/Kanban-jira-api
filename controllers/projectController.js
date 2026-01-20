import Project from '../models/project.model.js';
import Board from '../models/board.model.js';
import Organization from '../models/organization.model.js';
import User from '../models/user.model.js';
import { canCreateProject, canAssignProject, isAdminOrOwner } from '../utils/permissions.js';

/**
 * Get all projects where user is a member
 */
export const getProjects = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    // Get organization ID (handle both populated and non-populated cases)
    const organizationId = user.organization._id || user.organization;
    const userIdStr = req.user.id.toString();
    const userIdObj = req.user.id; // Keep as ObjectId for query

    console.log('Fetching projects for user:', {
      userId: userIdStr,
      userRole: user.role,
      organizationId: organizationId.toString()
    });

    // First, get all projects in the organization
    const allOrgProjects = await Project.find({
      organization: organizationId,
    })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .populate('organization', 'name')
      .sort({ createdAt: -1 });

    console.log('All projects in organization:', {
      totalProjects: allOrgProjects.length,
      projects: allOrgProjects.map(p => {
        const membersList = p.members ? p.members.map(m => {
          const userId = m.user?._id 
            ? m.user._id.toString() 
            : m.user?.toString() || m.user.toString();
          return {
            userId: userId,
            role: m.role || 'member',
          };
        }) : [];
        
        return {
          id: p._id.toString(),
          name: p.name,
          createdBy: (p.createdBy._id || p.createdBy).toString(),
          members: membersList,
          membersCount: membersList.length
        };
      })
    });

    // Filter projects where user has access:
    // 1. User is org admin/owner (sees ALL projects)
    // 2. User is explicitly a member
    // 3. User is the creator
    const accessibleProjects = allOrgProjects.filter(project => {
      // Org admin/owner can see all projects
      if (user.role === 'owner' || user.role === 'admin') {
        return true;
      }

      // Check if user is the creator (handle both populated and non-populated)
      const createdById = project.createdBy?._id 
        ? project.createdBy._id.toString() 
        : project.createdBy?.toString() || project.createdBy.toString();
      
      if (createdById === userIdStr) {
        console.log(`User ${userIdStr} is creator of project ${project._id}`);
        return true;
      }

      // Check if user is a member (handle both populated and non-populated member.user)
      console.log(`Checking membership for project "${project.name}" (${project._id}):`);
      console.log(`  Looking for user: ${userIdStr}`);
      console.log(`  Project has ${project.members?.length || 0} members`);
      
      const isMember = project.members && project.members.some((member, index) => {
        if (!member || !member.user) {
          console.log(`  Member[${index}]: Invalid member object:`, JSON.stringify(member));
          return false;
        }
        
        // Handle different member.user formats
        let memberUserId;
        if (member.user._id) {
          memberUserId = member.user._id.toString();
        } else if (typeof member.user === 'object' && member.user.toString) {
          memberUserId = member.user.toString();
        } else {
          memberUserId = String(member.user);
        }
        
        const matches = memberUserId === userIdStr;
        console.log(`  Member[${index}]: userId=${memberUserId}, role=${member.role || 'member'}, matches=${matches}`);
        
        if (matches) {
          console.log(`✅ User ${userIdStr} IS a member of project ${project._id} (${project.name}) with role ${member.role || 'member'}`);
        }
        return matches;
      });
      
      if (!isMember) {
        console.log(`❌ User ${userIdStr} is NOT a member of project ${project._id} (${project.name})`);
      }

      if (isMember) {
        return true;
      }

      // User doesn't have access
      console.log(`User ${userIdStr} does NOT have access to project ${project._id} (${project.name})`);
      return false;
    });

    console.log('=== PROJECT ACCESS SUMMARY ===');
    console.log('User:', {
      id: userIdStr,
      role: user.role,
      organizationId: organizationId.toString()
    });
    console.log('Organization Projects:', {
      total: allOrgProjects.length,
      accessible: accessibleProjects.length
    });
    
    if (accessibleProjects.length > 0) {
      console.log('Accessible Projects:');
      accessibleProjects.forEach(p => {
        const createdById = p.createdBy?._id 
          ? p.createdBy._id.toString() 
          : p.createdBy?.toString() || p.createdBy.toString();
        const isCreator = createdById === userIdStr;
        const isMember = p.members && p.members.some(m => {
          const memberUserId = m.user._id 
            ? m.user._id.toString() 
            : m.user.toString();
          return memberUserId === userIdStr;
        });
        const reason = (user.role === 'owner' || user.role === 'admin') 
          ? 'org_admin' 
          : isCreator 
            ? 'creator' 
            : isMember 
              ? 'member' 
              : 'none';
        
        console.log(`  - ${p.name} (${p._id}): ${reason}`);
        console.log(`    Members: ${p.members?.length || 0}`, 
          p.members?.map(m => {
            const mid = m.user._id ? m.user._id.toString() : m.user.toString();
            return `${mid}(${m.role})`;
          }).join(', ') || 'none'
        );
      });
    } else {
      console.log('⚠️  NO ACCESSIBLE PROJECTS FOUND');
      console.log('This might mean:');
      console.log('  1. User is not a member of any projects');
      console.log('  2. User is not org admin/owner');
      console.log('  3. No projects exist in the organization');
    }
    console.log('==============================');

    // Always return an array, even if empty
    res.json(accessibleProjects || []);
  } catch (err) {
    console.error('Error in getProjects:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Get project by ID (only members can view)
 */
export const getProjectById = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .populate('organization', 'name');

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    // Get organization IDs (handle both populated and non-populated cases)
    const userOrgId = user.organization._id || user.organization;
    const projectOrgId = project.organization._id || project.organization;

    // Check if user belongs to same organization
    if (projectOrgId.toString() !== userOrgId.toString()) {
      console.log('Organization mismatch:', {
        userId: req.user.id,
        userOrgId: userOrgId.toString(),
        projectOrgId: projectOrgId.toString()
      });
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Check if user is a member (handle both populated and non-populated member.user)
    const userIdStr = req.user.id.toString();
    const isMember = project.members.some((m) => {
      const memberUserId = (m.user._id || m.user).toString();
      return memberUserId === userIdStr;
    });

    // Also check if user is the project creator
    const isCreator = (project.createdBy._id || project.createdBy).toString() === userIdStr;

    // Allow access if: user is project member, creator, or org admin/owner
    if (!isMember && !isCreator && user.role !== 'owner' && user.role !== 'admin') {
      console.log('Access denied for project:', {
        userId: userIdStr,
        userRole: user.role,
        isMember,
        isCreator,
        projectMembers: project.members.map(m => ({
          memberUserId: (m.user._id || m.user).toString(),
          memberRole: m.role
        }))
      });
      return res.status(403).json({ msg: 'Access denied. You must be a project member to view this project.' });
    }

    res.json(project);
  } catch (err) {
    console.error('Error in getProjectById:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

/**
 * Create project (admin/owner only)
 */
export const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const user = await User.findById(req.user.id).populate('organization');
    
    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    if (!canCreateProject(user, organization)) {
      return res.status(403).json({ msg: 'Only admin/owner can create projects' });
    }

    const project = new Project({
      name,
      description,
      organization: organization._id,
      createdBy: req.user.id,
      members: [
        {
          user: req.user.id,
          role: 'admin',
        },
      ],
    });

    await project.save();
    await project.populate('createdBy', 'name email');
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Update project (only project admin or org admin/owner)
 */
export const updateProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const user = await User.findById(req.user.id).populate('organization');
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check if user is project admin or org admin/owner
    const isProjectAdmin = project.members.some(
      (m) => (m.user.toString() === req.user.id) && m.role === 'admin'
    );

    if (!isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    project.name = name || project.name;
    project.description = description !== undefined ? description : project.description;

    await project.save();
    await project.populate('createdBy', 'name email');
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Delete project (only project admin or org admin/owner)
 */
export const deleteProject = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check if user is project admin or org admin/owner
    const isProjectAdmin = project.members.some(
      (m) => (m.user.toString() === req.user.id) && m.role === 'admin'
    );

    if (!isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Delete all boards in this project
    await Board.deleteMany({ project: project._id });

    await Project.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Project removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Assign user to project (admin/owner only)
 */
export const assignProject = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(req.user.id).populate('organization');
    
    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!canAssignProject(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate user belongs to same organization
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.organization.toString() !== organization._id.toString()) {
      return res.status(400).json({ msg: 'User must belong to same organization' });
    }

    // Check if user is already a member
    if (project.members.some((m) => m.user.toString() === userId)) {
      return res.status(400).json({ msg: 'User already in project' });
    }

    // Add member
    project.members.push({
      user: userId,
      role: 'member',
    });

    await project.save();
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Add member to project (project admin or org admin/owner)
 */
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(req.user.id).populate('organization');
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check if user is project admin or org admin/owner
    const isProjectAdmin = project.members.some(
      (m) => (m.user.toString() === req.user.id) && m.role === 'admin'
    );

    if (!isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate user belongs to same organization
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (targetUser.organization.toString() !== organization._id.toString()) {
      return res.status(400).json({ msg: 'User must belong to same organization' });
    }

    // Check if user is already a member
    if (project.members.some((m) => m.user.toString() === userId)) {
      return res.status(400).json({ msg: 'User already in project' });
    }

    project.members.push({
      user: userId,
      role: 'member',
    });

    await project.save();
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Remove member from project (project admin or org admin/owner)
 */
export const removeMember = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('organization');
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check if user is project admin or org admin/owner
    const isProjectAdmin = project.members.some(
      (m) => (m.user.toString() === req.user.id) && m.role === 'admin'
    );

    if (!isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Don't allow removing the creator
    if (project.createdBy.toString() === req.params.userId) {
      return res.status(400).json({ msg: 'Cannot remove project creator' });
    }

    project.members = project.members.filter(
      (m) => m.user.toString() !== req.params.userId
    );

    await project.save();
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * Update member role (project admin or org admin/owner)
 */
export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.user.id).populate('organization');
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ msg: 'Project not found' });
    }

    if (!user.organization) {
      return res.status(404).json({ msg: 'User does not belong to an organization' });
    }

    const organization = await Organization.findById(user.organization);

    // Check if user is project admin or org admin/owner
    const isProjectAdmin = project.members.some(
      (m) => (m.user.toString() === req.user.id) && m.role === 'admin'
    );

    if (!isProjectAdmin && !isAdminOrOwner(user, organization)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Don't allow changing creator's role
    if (project.createdBy.toString() === req.params.userId) {
      return res.status(400).json({ msg: 'Cannot change project creator role' });
    }

    const memberToUpdate = project.members.find(
      (m) => m.user.toString() === req.params.userId
    );

    if (!memberToUpdate) {
      return res.status(404).json({ msg: 'Member not found' });
    }

    memberToUpdate.role = role;

    await project.save();
    await project.populate('members.user', 'name email');
    await project.populate('organization', 'name');

    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};
