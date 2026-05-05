import FriendRequest from '../models/FriendRequest.js';
import Friend from '../models/Friend.js';
import User from '../models/User.js';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errorHandler.js';

// @desc    Send friend request
// @route   POST /api/friend/add
// @access  Private
export const addFriend = async (req, res, next) => {
  try {
    const { userId } = req.body; // ID của người nhận lời mời
    const fromUserId = req.user._id; // ID của người gửi (từ protectedRoute)

    // Validate
    if (!userId) {
      throw new ValidationError('Vui lòng cung cấp ID người dùng');
    }

    if (userId === fromUserId.toString()) {
      throw new ValidationError('Không thể gửi lời mời kết bạn cho chính mình');
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Check if blocked
    const blockCheck = await Friend.findOne({
      $or: [
        { userId: fromUserId, friendId: userId, isBlocked: true },
        { userId: userId, friendId: fromUserId, isBlocked: true }
      ]
    });

    if (blockCheck) {
      throw new ForbiddenError('Không thể gửi lời mời kết bạn cho người dùng này');
    }

    // Check if already friends
    const areFriends = await Friend.areFriends(fromUserId, userId);

    if (areFriends) {
      throw new ConflictError('Bạn đã là bạn bè với người dùng này rồi');
    }

    // Check if friend request already exists (both directions)
    const existingRequest = await FriendRequest.exists(fromUserId, userId);
    if (existingRequest) {
      throw new ConflictError('Lời mời kết bạn đã tồn tại');
    }

    // Delete old non-pending requests to avoid unique constraint error
    await FriendRequest.deleteMany({
      $or: [
        { from: fromUserId, to: userId },
        { from: userId, to: fromUserId }
      ],
      status: { $ne: 'pending' }
    });

    // Create friend request
    const friendRequest = await FriendRequest.create({
      from: fromUserId,
      to: userId
    });

    await friendRequest.populate([
      { path: 'from', select: 'username displayName avatarUrl' },
      { path: 'to', select: 'username displayName avatarUrl' }
    ]);

    // Emit socket event to recipient
    const { io } = await import('../socket/index.js');
    io.to(userId.toString()).emit('friend-request-received', {
      request: friendRequest
    });

    res.status(201).json({
      success: true,
      message: 'Đã gửi lời mời kết bạn thành công',
      data: friendRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get received friend requests
// @route   GET /api/friend/requests
// @access  Private
export const getFriendsRequest = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const friendRequests = await FriendRequest.find({
      to: userId,
      status: 'pending'
    })
      .populate('from', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FriendRequest.countDocuments({
      to: userId,
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      data: friendRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all friend requests (sent + received)
// @route   GET /api/friend/requests/all
// @access  Private
export const getAllFriendRequests = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get received requests
    const received = await FriendRequest.find({
      to: userId,
      status: 'pending'
    })
      .populate('from', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 });

    // Get sent requests
    const sent = await FriendRequest.find({
      from: userId,
      status: 'pending'
    })
      .populate('to', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      sent,
      received
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sent friend requests
// @route   GET /api/friend/requests/sent
// @access  Private
export const getSentFriendRequests = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const friendRequests = await FriendRequest.find({
      from: userId,
      status: 'pending'
    })
      .populate('to', 'username displayName avatarUrl bio')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FriendRequest.countDocuments({
      from: userId,
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      data: friendRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept friend request
// @route   POST /api/friend/accept/:requestId
// @access  Private
export const acceptFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    // Find friend request
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      throw new NotFoundError('Không tìm thấy lời mời kết bạn');
    }

    // Verify the user is the recipient
    if (friendRequest.to.toString() !== userId.toString()) {
      throw new ValidationError('Bạn không có quyền chấp nhận lời mời này');
    }

    // Check if already accepted
    if (friendRequest.status === 'accepted') {
      throw new ConflictError('Lời mời kết bạn đã được chấp nhận');
    }

    // Check if expired or declined
    if (friendRequest.status !== 'pending') {
      throw new ValidationError(`Không thể chấp nhận lời mời đã ${friendRequest.status === 'declined' ? 'từ chối' : 'hết hạn'}`);
    }

    // Accept the request (this will create Friend records)
    await friendRequest.accept();

    // Populate for response
    await friendRequest.populate([
      { path: 'from', select: 'username displayName avatarUrl' },
      { path: 'to', select: 'username displayName avatarUrl' }
    ]);

    // Emit socket event to sender
    const { io } = await import('../socket/index.js');
    io.to(friendRequest.from.toString()).emit('friend-request-accepted', {
      request: friendRequest,
      acceptedBy: userId
    });
    
    // Also emit to the person who accepted (to refresh their UI)
    io.to(userId.toString()).emit('friend-added', {
      friend: friendRequest.from
    });

    res.status(200).json({
      success: true,
      message: 'Đã chấp nhận lời mời kết bạn',
      data: friendRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline friend request
// @route   POST /api/friend/decline/:requestId
// @access  Private
export const declineFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    // Find friend request
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      throw new NotFoundError('Không tìm thấy lời mời kết bạn');
    }

    // Verify the user is the recipient
    if (friendRequest.to.toString() !== userId.toString()) {
      throw new ValidationError('Bạn không có quyền từ chối lời mời này');
    }

    // Check if can decline
    if (friendRequest.status !== 'pending') {
      throw new ValidationError(`Không thể từ chối lời mời đã ${friendRequest.status === 'accepted' ? 'chấp nhận' : 'hết hạn'}`);
    }

    const senderId = friendRequest.from;

    // Decline the request
    await friendRequest.reject();

    // Emit socket event to sender
    const { io } = await import('../socket/index.js');
    io.to(senderId.toString()).emit('friend-request-declined', {
      requestId,
      declinedBy: userId
    });

    res.status(200).json({
      success: true,
      message: 'Đã từ chối lời mời kết bạn'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel sent friend request
// @route   DELETE /api/friend/cancel/:requestId
// @access  Private
export const cancelFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;

    // Find friend request
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      throw new NotFoundError('Không tìm thấy lời mời kết bạn');
    }

    // Verify the user is the sender
    if (friendRequest.from.toString() !== userId.toString()) {
      throw new ValidationError('Bạn không có quyền hủy lời mời này');
    }

    // Check if can cancel
    if (friendRequest.status !== 'pending') {
      throw new ValidationError(`Không thể hủy lời mời đã ${friendRequest.status === 'accepted' ? 'được chấp nhận' : 'hết hạn'}`);
    }

    // Delete the request
    await friendRequest.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Đã hủy lời mời kết bạn'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all friends
// @route   GET /api/friend/all
// @access  Private
export const getAllFriend = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 50, search = '' } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      includeBlocked: false
    };

    const result = await Friend.getFriends(userId, options);

    res.status(200).json({
      success: true,
      data: result.friends,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unfriend a user
// @route   DELETE /api/friend/unfriend/:friendId
// @access  Private
export const unFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Validate
    if (!friendId) {
      throw new ValidationError('Vui lòng cung cấp ID bạn bè');
    }

    if (friendId === userId.toString()) {
      throw new ValidationError('Không thể hủy kết bạn với chính mình');
    }

    // Check if they are friends
    const areFriends = await Friend.areFriends(userId, friendId);
    if (!areFriends) {
      throw new NotFoundError('Bạn chưa là bạn bè với người dùng này');
    }

    // Remove friendship (both directions)
    await Friend.removeFriendship(userId, friendId);

    // Also delete any old friend requests between them
    await FriendRequest.deleteMany({
      $or: [
        { from: userId, to: friendId },
        { from: friendId, to: userId }
      ]
    });

    // Emit socket event to both users
    const { io } = await import('../socket/index.js');
    io.to(userId.toString()).emit('friend-removed', {
      friendId: friendId
    });
    io.to(friendId.toString()).emit('friend-removed', {
      friendId: userId
    });

    res.status(200).json({
      success: true,
      message: 'Đã hủy kết bạn thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Block a friend
// @route   POST /api/friend/block/:friendId
// @access  Private
export const blockFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Validate
    if (!friendId) {
      throw new ValidationError('Vui lòng cung cấp ID bạn bè');
    }

    if (friendId === userId.toString()) {
      throw new ValidationError('Không thể chặn chính mình');
    }

    // Check if target user exists
    const targetUser = await User.findById(friendId);
    if (!targetUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Check if they are friends
    const areFriends = await Friend.areFriends(userId, friendId);
    
    // If they are friends, remove friendship first
    if (areFriends) {
      await Friend.removeFriendship(userId, friendId);
    }

    // Find or create friendship record for blocking
    let friendship = await Friend.findOne({
      userId: userId,
      friendId: friendId
    });

    if (!friendship) {
      // Create new friendship record just for blocking
      friendship = await Friend.create({
        userId: userId,
        friendId: friendId,
        isBlocked: true,
        blockedBy: userId,
        blockedAt: new Date()
      });
    } else {
      // Update existing record
      friendship.isBlocked = true;
      friendship.blockedBy = userId;
      friendship.blockedAt = new Date();
      await friendship.save();
    }

    // Also create/update reverse record
    let reverseFriendship = await Friend.findOne({
      userId: friendId,
      friendId: userId
    });

    if (!reverseFriendship) {
      await Friend.create({
        userId: friendId,
        friendId: userId,
        isBlocked: true,
        blockedBy: userId,
        blockedAt: new Date()
      });
    } else {
      reverseFriendship.isBlocked = true;
      reverseFriendship.blockedBy = userId;
      reverseFriendship.blockedAt = new Date();
      await reverseFriendship.save();
    }

    // Emit socket event to both users
    const { io } = await import('../socket/index.js');
    const currentUser = await User.findById(userId).select('displayName');
    
    // Notify the person who blocked
    io.to(userId.toString()).emit('user-blocked', {
      userId: friendId,
      blockedBy: userId,
      message: `Bạn đã chặn ${targetUser.displayName}`
    });
    
    // Notify the person who was blocked
    io.to(friendId.toString()).emit('user-blocked', {
      userId: userId,
      blockedBy: userId,
      message: `${currentUser.displayName} đã chặn bạn`
    });

    res.status(200).json({
      success: true,
      message: 'Đã chặn người dùng thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unblock a friend
// @route   POST /api/friend/unblock/:friendId
// @access  Private
export const unblockFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // Validate
    if (!friendId) {
      throw new ValidationError('Vui lòng cung cấp ID bạn bè');
    }

    // Find and delete all block records (both directions)
    await Friend.deleteMany({
      $or: [
        { userId: userId, friendId: friendId, isBlocked: true },
        { userId: friendId, friendId: userId, isBlocked: true }
      ]
    });

    // Emit socket event to both users
    const { io } = await import('../socket/index.js');
    
    // Notify both users that unblock happened
    io.to(userId.toString()).emit('user-unblocked', {
      userId: friendId
    });
    
    io.to(friendId.toString()).emit('user-unblocked', {
      userId: userId
    });

    res.status(200).json({
      success: true,
      message: 'Đã bỏ chặn thành công'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get blocked friends
// @route   GET /api/friend/blocked
// @access  Private
export const getBlockedFriends = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const blockedFriends = await Friend.find({
      userId: userId,
      isBlocked: true,
      blockedBy: userId
    })
      .populate('friendId', 'username displayName avatarUrl bio')
      .sort({ blockedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Friend.countDocuments({
      userId: userId,
      isBlocked: true,
      blockedBy: userId
    });

    res.status(200).json({
      success: true,
      data: blockedFriends,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check friendship status with a user
// @route   GET /api/friend/status/:userId
// @access  Private
export const getFriendshipStatus = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user._id;

    // Check if same user
    if (targetUserId === currentUserId.toString()) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'self',
          message: 'Đây là trang cá nhân của bạn'
        }
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Check friendship record (including blocked)
    const friendship = await Friend.findOne({
      userId: currentUserId,
      friendId: targetUserId
    });

    if (friendship) {
      return res.status(200).json({
        success: true,
        data: {
          status: friendship.isBlocked ? 'blocked' : 'friends',
          friendship,
          blockedBy: friendship.isBlocked ? friendship.blockedBy : null
        }
      });
    }

    // Check for pending friend request
    const pendingRequest = await FriendRequest.findOne({
      $or: [
        { from: currentUserId, to: targetUserId },
        { from: targetUserId, to: currentUserId }
      ],
      status: 'pending'
    });

    if (pendingRequest) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'pending',
          direction: pendingRequest.from.toString() === currentUserId.toString() ? 'sent' : 'received',
          request: pendingRequest
        }
      });
    }

    // No relationship
    res.status(200).json({
      success: true,
      data: {
        status: 'none',
        message: 'Chưa có mối quan hệ bạn bè'
      }
    });
  } catch (error) {
    next(error);
  }
};
