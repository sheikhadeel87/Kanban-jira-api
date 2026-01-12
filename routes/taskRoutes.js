import express from 'express';
import multerImport from 'multer';
import auth from '../middleware/auth.js';
import { storage } from '../config/cloudinary.js';
import {
  getTasksByBoard,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from '../controllers/taskController.js';

const multer = multerImport.default || multerImport; // support CJS/ESM interop

const router = express.Router();

// Multer config with Cloudinary storage
const upload = multer({ storage });

// Middleware to parse FormData arrays
const parseFormDataArrays = (req, res, next) => {
  if (req.body['assignedTo[]']) {
    req.body.assignedTo = Array.isArray(req.body['assignedTo[]'])
      ? req.body['assignedTo[]']
      : [req.body['assignedTo[]']];
    delete req.body['assignedTo[]'];
  }
  next();
};

router.get('/board/:boardId', auth, getTasksByBoard);
router.post('/', auth, upload.single('attachment'), parseFormDataArrays, createTask);
router.put('/:id', auth, upload.single('attachment'), parseFormDataArrays, updateTask);
router.patch('/:id/status', auth, updateTaskStatus);
router.delete('/:id', auth, deleteTask);

export default router;


