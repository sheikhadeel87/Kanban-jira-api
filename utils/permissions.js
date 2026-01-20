/**
 * Permission utility functions for organization-based access control
 */

/**
 * Get user's role in organization
 */
export const getUserRole = (user, organization) => {
  if (!user || !organization) return null;
  
  // Owner is stored in organization.owner
  const ownerId = organization.owner?._id || organization.owner;
  if (ownerId && ownerId.toString() === user._id.toString()) {
    return 'owner';
  }
  
  // Otherwise return user's role (admin or member)
  return user.role;
};

/**
 * Check if user is organization owner
 */
export const isOwner = (user, organization) => {
  return getUserRole(user, organization) === 'owner';
};

/**
 * Check if user is organization admin or owner
 */
export const isAdminOrOwner = (user, organization) => {
  const role = getUserRole(user, organization);
  return role === 'owner' || role === 'admin';
};

/**
 * Check if user is organization member (any role)
 */
export const isMember = (user, organization) => {
  if (!user || !organization) return false;
  
  // If user has organization field and it matches, they're a member
  const userOrgId = user.organization?._id || user.organization;
  const orgId = organization._id || organization;
  
  if (userOrgId && orgId && userOrgId.toString() === orgId.toString()) {
    return true;
  }
  
  // Also check via getUserRole as fallback
  return getUserRole(user, organization) !== null;
};

/**
 * Permission checks based on the matrix:
 * 
 * | Action         | Owner | Admin | Member       |
 * | -------------- | ----- | ----- | ------------ |
 * | Create org     | ✅     | ❌     | ❌            |
 * | Delete org     | ✅     | ❌     | ❌            |
 * | Invite user    | ✅     | ✅     | ❌            |
 * | Create project | ✅     | ✅     | ❌            |
 * | Assign project | ✅     | ✅     | ❌            |
 * | Create board   | ✅     | ✅     | ❌            |
 * | Create task    | ✅     | ✅     | ✅            |
 * | Update task    | ✅     | ✅     | ✅ (assigned) |
 * | Delete task    | ✅     | ✅     | ❌            |
 */

export const canCreateOrg = (user) => {
  // Only users not in any org can create (handled in controller)
  return true;
};

export const canDeleteOrg = (user, organization) => {
  return isOwner(user, organization);
};

export const canInviteUser = (user, organization) => {
  return isAdminOrOwner(user, organization);
};

export const canCreateProject = (user, organization) => {
  return isAdminOrOwner(user, organization);
};

export const canAssignProject = (user, organization) => {
  return isAdminOrOwner(user, organization);
};

export const canCreateBoard = (user, organization) => {
  return isAdminOrOwner(user, organization);
};

export const canCreateTask = (user, organization) => {
  // All members can create tasks
  return isMember(user, organization);
};

export const canUpdateTask = (user, organization, task) => {
  if (!isMember(user, organization)) return false;
  
  // Owner and Admin can always update
  if (isAdminOrOwner(user, organization)) return true;
  
  // Member can only update if assigned
  const isAssigned = task.assignedTo.some(
    (userId) => userId.toString() === user._id.toString()
  );
  return isAssigned;
};

export const canDeleteTask = (user, organization) => {
  return isAdminOrOwner(user, organization);
};
