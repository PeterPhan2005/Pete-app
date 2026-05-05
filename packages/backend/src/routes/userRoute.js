import express from 'express';
import { authMe, searchUser, updateProfile, changePassword, deleteAccount, uploadAvatar } from '../controllers/userController.js';
import { upload } from '../config/cloudinary.js';
import { cacheMiddleware, cacheKeys } from '../middlewares/cacheMiddleware.js';

const router = express.Router();

// Cache user profile for 5 minutes
router.get("/me", cacheMiddleware(300, (req) => cacheKeys.userProfile(req.user._id)), authMe);

// Cache search results for 2 minutes
router.get("/search", cacheMiddleware(120), searchUser);

router.put("/profile", updateProfile);
router.put("/change-password", changePassword);
router.delete("/account", deleteAccount);
router.post("/avatar", upload.single('avatar'), uploadAvatar);

export default router;