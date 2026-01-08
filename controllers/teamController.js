import Team from "../models/team.model.js";
import Board from "../models/board.model.js";

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
