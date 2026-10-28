import express from "express";
import { register, login, getProfile, updateProfile, logout } from "../controllers/userregistercontroller.js";
import authMiddleware from "../middleware/authmiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", authMiddleware, getProfile);
router.put("/profile/:id", authMiddleware, updateProfile);
router.post("/logout", authMiddleware, logout);
router.get("/logout", authMiddleware, logout);

export default router;

