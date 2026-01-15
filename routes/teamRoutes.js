import express from "express";
import auth from "../middleware/auth.js";
import {
  createTeam,
  getTeamByBoard,
  addMember,
  deleteMember,
  getMyTeamMembers,
} from "../controllers/teamController.js";

const router = express.Router();

// IMPORTANT: Static routes (like /members) must come before parameterized routes (like /:teamId)
router.get("/members", auth, getMyTeamMembers); // Get team members for current user (from Team table)
router.post("/", auth, createTeam);
router.get("/board/:boardId", auth, getTeamByBoard);
router.post("/:teamId/add", auth, addMember);
router.delete("/:teamId/remove/:userId", auth, deleteMember);

export default router;
