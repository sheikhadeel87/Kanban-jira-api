import express from "express";
import auth from "../middleware/auth.js";
import {
  createTeam,
  getTeamByBoard,
  addMember,
  deleteMember,
} from "../controllers/teamController.js";

const router = express.Router();

router.post("/", auth, createTeam);
router.get("/board/:boardId", auth, getTeamByBoard);
router.post("/:teamId/add", auth, addMember);
router.delete("/:teamId/remove/:userId", auth, deleteMember);

export default router;
