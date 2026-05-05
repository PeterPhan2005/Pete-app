import User from '../models/User.js';
import { ValidationError, NotFoundError } from '../utils/errorHandler.js';
import bcrypt from 'bcryptjs';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { invalidateCache, cacheKeys } from '../middlewares/cacheMiddleware.js';

export const authMe = (req, res) => {
    try {
        const user = req.user;
        res.status(200).json({ user });
    } catch (error) {
        console.error('❌ Error in authMe:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// @desc    Search users by username or email
// @route   GET /api/user/search?username=xxx
// @access  Private
export const searchUser = async (req, res, next) => {
    try {
        const { username } = req.query;
        const currentUserId = req.user._id;

        if (!username) {
            throw new ValidationError('Vui lòng cung cấp username hoặc email để tìm kiếm');
        }

        // Search for users by username or email (case-insensitive, partial match)
        // IMPORTANT: Exclude current user from search results
        const users = await User.find({
            $or: [
                { username: { $regex: username, $options: 'i' } },
                { email: { $regex: username, $options: 'i' } }
            ],
            _id: { $ne: currentUserId } // Exclude current user
        })
        .select('username displayName avatarUrl bio email')
        .limit(10);

        // Return empty array if no users found (don't throw error)
        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Update user profile (displayName, phone, bio only)
// @route   PUT /api/user/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { displayName, phone, bio } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError('Không tìm thấy người dùng');
        }

        // Update only allowed fields
        if (displayName !== undefined) {
            if (!displayName.trim()) {
                throw new ValidationError('Tên hiển thị không được để trống');
            }
            user.displayName = displayName.trim();
        }

        if (phone !== undefined) {
            // Allow empty string to clear phone
            if (phone === '' || phone === null) {
                user.phone = null;
            } else {
                // Validate phone format
                const phoneRegex = /^\+?[0-9]{10,15}$/;
                if (!phoneRegex.test(phone)) {
                    throw new ValidationError('Số điện thoại không hợp lệ');
                }
                user.phone = phone;
            }
        }

        if (bio !== undefined) {
            // Allow empty string to clear bio
            if (bio === '' || bio === null) {
                user.bio = null;
            } else if (bio.length > 200) {
                throw new ValidationError('Giới thiệu không được vượt quá 200 ký tự');
            } else {
                user.bio = bio;
            }
        }

        await user.save();

        // Invalidate user cache
        await invalidateCache([
            cacheKeys.userProfile(userId),
            cacheKeys.user(userId),
            `cache:*/user/me*${userId}*`
        ]);

        // Emit socket event to notify friends and conversation members about profile update
        const { io } = await import('../socket/index.js');
        const Friend = (await import('../models/Friend.js')).default;
        const Participant = (await import('../models/Participant.js')).default;
        
        // Get all friends
        const friends = await Friend.find({
            $or: [
                { userId: userId, status: 'accepted' },
                { friendId: userId, status: 'accepted' }
            ]
        });
        
        const friendIds = friends.map(f => 
            f.userId.toString() === userId.toString() ? f.friendId.toString() : f.userId.toString()
        );
        
        // Get all conversations user is part of
        const conversations = await Participant.find({
            userId: userId,
            leftAt: null
        }).select('conversationId');
        
        const conversationIds = conversations.map(c => c.conversationId.toString());
        
        // Emit to friends' personal rooms
        friendIds.forEach(friendId => {
            io.to(`user:${friendId}`).emit('user-profile-updated', {
                userId: userId.toString(),
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                bio: user.bio
            });
        });
        
        // Emit to all conversations user is in
        conversationIds.forEach(conversationId => {
            io.to(conversationId).emit('user-profile-updated', {
                userId: userId.toString(),
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                bio: user.bio
            });
        });

        res.status(200).json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/user/change-password
// @access  Private
export const changePassword = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            throw new ValidationError('Vui lòng cung cấp đầy đủ thông tin');
        }

        if (newPassword !== confirmPassword) {
            throw new ValidationError('Mật khẩu mới không khớp');
        }

        if (newPassword.length < 6) {
            throw new ValidationError('Mật khẩu mới phải có ít nhất 6 ký tự');
        }

        if (currentPassword === newPassword) {
            throw new ValidationError('Mật khẩu mới phải khác mật khẩu hiện tại');
        }

        // Find user with password field
        const user = await User.findById(userId).select('+hashedPassword');
        if (!user) {
            throw new NotFoundError('Không tìm thấy người dùng');
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            throw new ValidationError('Mật khẩu hiện tại không đúng');
        }

        // Update password
        user.hashedPassword = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user account
// @route   DELETE /api/user/account
// @access  Private
export const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { password } = req.body;

        // Validate password
        if (!password) {
            throw new ValidationError('Vui lòng nhập mật khẩu để xác nhận');
        }

        // Find user with password field
        const user = await User.findById(userId).select('+hashedPassword');
        if (!user) {
            throw new NotFoundError('Không tìm thấy người dùng');
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new ValidationError('Mật khẩu không đúng');
        }

        // TODO: Clean up user data (conversations, messages, friend requests, etc.)
        // For now, just delete the user
        await User.findByIdAndDelete(userId);

        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được xóa thành công'
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Upload avatar
// @route   POST /api/user/avatar
// @access  Private
export const uploadAvatar = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Check if file exists
    if (!req.file) {
      throw new ValidationError('Vui lòng chọn file ảnh');
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Delete old avatar from Cloudinary if exists
    if (user.avatarId) {
      await deleteFromCloudinary(user.avatarId);
    }

    // Upload new avatar to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    // Update user avatar
    user.avatarUrl = result.secure_url;
    user.avatarId = result.public_id;
    await user.save();

    // Invalidate user cache
    await invalidateCache([
      cacheKeys.userProfile(userId),
      cacheKeys.user(userId),
      `cache:*/user/me*${userId}*`
    ]);

    // Emit socket event to notify friends and conversation members about avatar update
    const { io } = await import('../socket/index.js');
    const Friend = (await import('../models/Friend.js')).default;
    const Participant = (await import('../models/Participant.js')).default;
    
    // Get all friends
    const friends = await Friend.find({
        $or: [
            { userId: userId, status: 'accepted' },
            { friendId: userId, status: 'accepted' }
        ]
    });
    
    const friendIds = friends.map(f => 
        f.userId.toString() === userId.toString() ? f.friendId.toString() : f.userId.toString()
    );
    
    // Get all conversations user is part of
    const conversations = await Participant.find({
        userId: userId,
        leftAt: null
    }).select('conversationId');
    
    const conversationIds = conversations.map(c => c.conversationId.toString());
    
    // Emit to friends' personal rooms
    friendIds.forEach(friendId => {
        io.to(`user:${friendId}`).emit('user-profile-updated', {
            userId: userId.toString(),
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio
        });
    });
    
    // Emit to all conversations user is in
    conversationIds.forEach(conversationId => {
        io.to(conversationId).emit('user-profile-updated', {
            userId: userId.toString(),
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio
        });
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật avatar thành công',
      data: {
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    next(error);
  }
};
