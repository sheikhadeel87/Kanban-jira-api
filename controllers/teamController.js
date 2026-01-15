import Team from "../models/team.model.js";
import Board from "../models/board.model.js";
import User from "../models/user.model.js";

/**
 * Create team for a board (called once)
 * Board creator becomes first member
 */
export const createTeam = async (req, res) => {
  try {
    const { boardId } = req.body;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ msg: "Board not found" });
    }

    // Only board owner or admin
    if (
      board.owner.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const team = await Team.create({
      board: boardId,
      members: [req.user.id],
      createdBy: req.user.id,
    });

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

/**
 * Get team by board
 * Only team members can view
 */
export const getTeamByBoard = async (req, res) => {
  try {
    const team = await Team.findOne({ board: req.params.boardId })
      .populate("members", "name email");

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    const isMember = team.members.some(
      (m) => m._id.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

/**
 * Add member to team
 * Only board creator or admin
 */
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;

    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    if (
      team.createdBy.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    if (team.members.includes(userId)) {
      return res.status(400).json({ msg: "User already in team" });
    }

    team.members.push(userId);
    await team.save();

    res.json(team);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

/**
 * Remove member from team
 * Only board creator or admin
 */
export const deleteMember = async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    if (
      team.createdBy.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    team.members = team.members.filter(
      (m) => m.toString() !== req.params.userId
    );

    await team.save();
    res.json({ msg: "Member removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

/**
 * Get team members for current user
 * Returns only members where current user is the inviter (inviting_id = current user)
 * Uses the new Team model structure with inviting_id and member_id
 */
export const getMyTeamMembers = async (req, res) => {
  try {
    console.log('📥 getMyTeamMembers endpoint called');
    console.log('Request path:', req.path);
    console.log('Request method:', req.method);
    
    // Get current user ID
    if (!req.user || !req.user._id) {
      console.log('❌ No user found in request');
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    
    const currentUserId = req.user._id;
    const currentUserIdStr = currentUserId.toString();
    console.log(`🔍 Getting team members for user ID: ${currentUserIdStr} from Team table`);

    // Query Team table - only records where inviting_id matches current user
    // IMPORTANT: Only show 'accepted' members - no one joins without email acceptance
    const teamRecords = await Team.find({
      inviting_id: currentUserId, // CRITICAL: Only records where current user is the inviter
      member_id: { $ne: null }, // Only show members who have registered
      status: 'accepted', // ONLY accepted members - requires email acceptance
    })
    .populate('member_id', 'name email role _id') // Join with User table
    .populate('inviting_id', 'name email'); // Join with User table for verification
    
    console.log(`📊 Found ${teamRecords.length} team records for inviting_id: ${currentUserIdStr}`);
    
    // If no team records found, return empty array
    if (!teamRecords || teamRecords.length === 0) {
      console.log(`✅ No team members found for user ${currentUserIdStr}`);
      return res.status(200).json([]);
    }
    
    // Extract users from team records (from Team table via populate)
    const users = teamRecords
      .filter(team => {
        if (!team.member_id || !team.member_id._id) return false;
        
        // Verify inviting_id matches current user (safety check)
        const teamInvitingId = team.inviting_id?._id?.toString() || team.inviting_id?.toString();
        const matches = teamInvitingId === currentUserIdStr;
        
        if (!matches) {
          console.error(`❌ SECURITY: Filtering out record - inviting_id ${teamInvitingId} != ${currentUserIdStr}`);
        }
        
        return matches;
      })
      .map(team => ({
        _id: team.member_id._id,
        name: team.member_id.name,
        email: team.member_id.email,
        role: team.member_id.role,
        invitedAt: team.invitedAt,
        acceptedAt: team.acceptedAt,
        status: team.status,
      }));
    
    console.log(`✅ Returning ${users.length} team members for user ${currentUserIdStr} from Team table`);
    
    // Return users from Team table (ONLY those where inviting_id = current user)
    return res.status(200).json(users);
  } catch (err) {
    console.error('Error in getMyTeamMembers:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
