import Conversation from '../models/Conversation.js';
import Participant from '../models/Participant.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Friend from '../models/Friend.js';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errorHandler.js';
import { invalidateCache, cacheKeys } from '../middlewares/cacheMiddleware.js';

// @desc    Tạo conversation 1-1
// @route   POST /api/conversation/direct
// @access  Private
export const createDirectConversation = async (req, res, next) => {
  try {
    const { userId: participantId } = req.body;
    const currentUserId = req.user._id;

    // Validate
    if (!participantId) {
      throw new ValidationError('Vui lòng cung cấp ID người dùng');
    }

    if (participantId === currentUserId.toString()) {
      throw new ValidationError('Không thể tạo cuộc trò chuyện với chính mình');
    }

    // Check user exists
    const participant = await User.findById(participantId);
    if (!participant) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Check if they are friends
    const areFriends = await Friend.areFriends(currentUserId, participantId);
    if (!areFriends) {
      throw new ForbiddenError('Bạn chỉ có thể nhắn tin với bạn bè');
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOrCreateDirect(currentUserId, participantId);
    
    // Get participant info
    const participants = await Participant.find({
      conversationId: existingConversation._id,
      leftAt: null
    }).populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Get the other user
    const otherParticipant = participants.find(
      p => p.userId._id.toString() !== currentUserId.toString()
    );
    const otherUser = otherParticipant ? otherParticipant.userId : null;

    // Get unread counts
    const unreadCounts = {};
    participants.forEach(p => {
      unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
    });

    // Get last message if exists
    let lastMessage = null;
    if (existingConversation.lastMessageContent) {
      lastMessage = {
        _id: existingConversation._id, // placeholder
        content: existingConversation.lastMessageContent,
        createdAt: existingConversation.lastMessageAt,
        sender: existingConversation.lastMessageSender ? {
          _id: existingConversation.lastMessageSender,
          displayName: '',
          avatarUrl: null
        } : null
      };
    }

    // Format response to match frontend expectations
    const conversationResponse = {
      _id: existingConversation._id,
      type: existingConversation.type,
      user: otherUser,
      participants: participants.map(p => p.userId),
      lastMessage,
      lastMessageAt: existingConversation.lastMessageAt,
      unreadCounts,
      seenBy: [],
      isPinned: false,
      isMuted: false,
      createdAt: existingConversation.createdAt,
      updatedAt: existingConversation.updatedAt
    };

    // Invalidate conversations cache for both users
    await invalidateCache([
      cacheKeys.userConversations(currentUserId),
      cacheKeys.userConversations(participantId)
    ]);

    // Emit new-conversation event to the other participant (participantId)
    // so their FE adds the conversation to the store in real-time without reload
    const currentUserParticipant = participants.find(
      p => p.userId._id.toString() === currentUserId.toString()
    );
    const currentUser = currentUserParticipant ? currentUserParticipant.userId : null;

    const participantConversationResponse = {
      ...conversationResponse,
      user: currentUser // From participant's perspective, the other user is currentUser
    };

    const { io } = await import('../socket/index.js');
    io.to(participantId.toString()).emit('new-conversation', participantConversationResponse);

    res.status(200).json({
      success: true,
      message: 'Tạo cuộc trò chuyện thành công',
      data: {
        conversation: conversationResponse,
        participants
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tạo nhóm chat
// @route   POST /api/conversation/group
// @access  Private
export const createGroupConversation = async (req, res, next) => {
  try {
    const { groupName, participantIds, groupDescription, groupAvatar } = req.body;
    const creatorId = req.user._id;

    // Validate
    if (!groupName || groupName.trim() === '') {
      throw new ValidationError('Vui lòng nhập tên nhóm');
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 1) {
      throw new ValidationError('Nhóm phải có ít nhất 2 thành viên (kể cả bạn)');
    }

    // Check all participants exist
    const participants = await User.find({ _id: { $in: participantIds } });
    if (participants.length !== participantIds.length) {
      throw new ValidationError('Một số người dùng không tồn tại');
    }

    // Create group conversation
    const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId.toString())];
    const conversation = await Conversation.createGroup(
      groupName,
      creatorId,
      allParticipants,
      groupDescription,
      groupAvatar
    );

    // Get full participant info
    const participantsData = await Participant.find({
      conversationId: conversation._id
    }).populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Build unread counts object
    const unreadCounts = {};
    participantsData.forEach(p => {
      unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
    });

    // Format response to match frontend expectations
    const conversationResponse = {
      _id: conversation._id,
      type: conversation.type,
      participants: participantsData.map(p => p.userId),
      group: {
        name: conversation.groupName,
        avatar: conversation.groupAvatar,
        description: conversation.groupDescription
      },
      createdBy: conversation.createdBy,
      admins: conversation.admins || [],
      settings: conversation.settings,
      pinnedMessages: conversation.pinnedMessages || [],
      lastMessage: null,
      lastMessageAt: conversation.lastMessageAt,
      unreadCounts,
      seenBy: [],
      isPinned: false,
      isMuted: false,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };

    // Emit socket event to all participants
    const { io } = await import('../socket/index.js');
    const serverInstance = process.env.INSTANCE_ID || 'unknown';
    
    console.log(`\n${'*'.repeat(80)}`);
    console.log(`📢 [${serverInstance}] EMITTING NEW GROUP CREATED`);
    console.log(`   👤 Creator: ${req.user.displayName}`);
    console.log(`   👥 Group: ${conversation.groupName}`);
    console.log(`   📊 Participants: ${allParticipants.length}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`${'*'.repeat(80)}\n`);
    
    allParticipants.forEach(participantId => {
      // Emit to all participants including creator for real-time sync
      io.to(participantId.toString()).emit('new-group', conversationResponse);
      console.log(`   ✅ Emitted to user: ${participantId}`);
    });

    // Invalidate conversations cache for all participants
    const cacheInvalidations = allParticipants.map(participantId => 
      cacheKeys.userConversations(participantId)
    );
    await invalidateCache(cacheInvalidations);

    res.status(201).json({
      success: true,
      message: 'Tạo nhóm thành công',
      data: {
        conversation: conversationResponse,
        participants: participantsData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách conversations của user
// @route   GET /api/conversation
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, search = '' } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      includeLeft: false,
      onlyPinned: false
    };

    // Get participants with populated conversation data
    const participants = await Participant.getUserConversations(userId, options);
    
    // Transform data to include conversation details and participant info
    const conversations = await Promise.all(
      participants.map(async (participant) => {
        const conversation = participant.conversationId;
        
        // Get all participants for this conversation
        const allParticipants = await Participant.find({
          conversationId: conversation._id,
          leftAt: null
        }).populate('userId', 'username displayName avatarUrl status lastSeen bio');
        
        // For direct conversations, get the other user
        let otherUser = null;
        if (conversation.type === 'direct') {
          const otherParticipant = allParticipants.find(
            p => p.userId._id.toString() !== userId.toString()
          );
          otherUser = otherParticipant ? otherParticipant.userId : null;
        }
        
        // Build unread counts object
        const unreadCounts = {};
        allParticipants.forEach(p => {
          unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
        });
        
        return {
          _id: conversation._id,
          type: conversation.type,
          lastMessage: conversation.lastMessageContent ? {
            _id: conversation._id, // placeholder
            content: conversation.lastMessageContent,
            createdAt: conversation.lastMessageAt,
            senderId: conversation.lastMessageSender?._id,
            sender: conversation.lastMessageSender
          } : null,
          lastMessageAt: conversation.lastMessageAt,
          unreadCounts,
          participants: allParticipants.map(p => p.userId),
          // Direct conversation specific
          ...(conversation.type === 'direct' && otherUser && {
            user: otherUser
          }),
          // Group conversation specific
          ...(conversation.type === 'group' && {
            group: {
              name: conversation.groupName,
              avatar: conversation.groupAvatar,
              description: conversation.groupDescription
            },
            createdBy: conversation.createdBy,
            admins: conversation.admins || [],
            settings: conversation.settings,
            pinnedMessages: conversation.pinnedMessages || []
          }),
          // User-specific settings
          isPinned: participant.isPinned,
          isMuted: participant.isMuted,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        };
      })
    );
    
    // Count total for pagination
    const total = await Participant.countDocuments({
      userId,
      leftAt: null
    });

    res.status(200).json({
      success: true,
      conversations,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages: Math.ceil(total / options.limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy chi tiết conversation
// @route   GET /api/conversation/:conversationId
// @access  Private
export const getConversationDetails = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId)
      .populate('createdBy', 'username displayName avatarUrl')
      .populate('admins', 'username displayName avatarUrl')
      .populate('lastMessageSender', 'username displayName avatarUrl');

    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is participant
    const isParticipant = await Participant.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Get participants
    const participants = await Participant.getConversationParticipants(conversationId);

    res.status(200).json({
      success: true,
      data: {
        conversation,
        participants
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Thêm thành viên vào nhóm
// @route   POST /api/conversation/:conversationId/participant
// @access  Private
export const addParticipant = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { userId: newParticipantId } = req.body;
    const currentUserId = req.user._id;

    // Validate
    if (!newParticipantId) {
      throw new ValidationError('Vui lòng cung cấp ID người dùng');
    }

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể thêm thành viên vào nhóm');
    }

    // Check permissions
    const isParticipant = await Participant.isParticipant(conversationId, currentUserId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của nhóm này');
    }

    // Check if only admins can invite
    if (conversation.settings?.allowMembersToInvite === false) {
      const isAdmin = conversation.isAdmin(currentUserId);
      if (!isAdmin) {
        throw new ForbiddenError('Chỉ quản trị viên mới có thể thêm thành viên');
      }
    }

    // Check new user exists
    const newUser = await User.findById(newParticipantId);
    if (!newUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Check if user is already an active participant
    let participant = await Participant.findOne({
      conversationId,
      userId: newParticipantId,
      leftAt: null
    });

    if (participant) {
      throw new ConflictError('Người dùng đã là thành viên của nhóm');
    }

    // Check if user was previously a member (kicked/left) - use findOneAndUpdate for atomicity
    participant = await Participant.findOneAndUpdate(
      {
        conversationId,
        userId: newParticipantId,
        leftAt: { $ne: null }
      },
      {
        $set: {
          leftAt: null,
          unreadCount: 0,
          lastSeenMessageId: null,
          joinedAt: new Date()
        }
      },
      { new: true }
    );

    if (!participant) {
      // No previous record found, create new participant
      try {
        participant = await Participant.create({
          conversationId,
          userId: newParticipantId
        });
      } catch (error) {
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
          // Try to find and reactivate again
          participant = await Participant.findOneAndUpdate(
            {
              conversationId,
              userId: newParticipantId
            },
            {
              $set: {
                leftAt: null,
                unreadCount: 0,
                lastSeenMessageId: null,
                joinedAt: new Date()
              }
            },
            { new: true }
          );
          
          if (!participant) {
            throw new ConflictError('Không thể thêm thành viên. Vui lòng thử lại.');
          }
        } else {
          throw error;
        }
      }
    }

    await participant.populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Get full conversation data to send to new participant
    const fullConversation = await Conversation.findById(conversationId)
      .populate('createdBy', 'username displayName avatarUrl')
      .populate('admins', 'username displayName avatarUrl')
      .populate('lastMessageSender', 'username displayName avatarUrl');

    const allParticipants = await Participant.find({
      conversationId,
      leftAt: null
    }).populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Build unread counts object
    const unreadCounts = {};
    allParticipants.forEach(p => {
      unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
    });

    // Format conversation for new participant
    const conversationForNewUser = {
      _id: fullConversation._id,
      type: fullConversation.type,
      participants: allParticipants.map(p => p.userId),
      group: {
        name: fullConversation.groupName,
        avatar: fullConversation.groupAvatar,
        description: fullConversation.groupDescription
      },
      createdBy: fullConversation.createdBy?._id || fullConversation.createdBy,
      admins: fullConversation.admins || [],
      settings: fullConversation.settings,
      pinnedMessages: fullConversation.pinnedMessages || [],
      lastMessage: fullConversation.lastMessageContent ? {
        _id: fullConversation._id,
        content: fullConversation.lastMessageContent,
        createdAt: fullConversation.lastMessageAt,
        sender: fullConversation.lastMessageSender
      } : null,
      lastMessageAt: fullConversation.lastMessageAt,
      unreadCounts,
      seenBy: [],
      isPinned: false,
      isMuted: false,
      createdAt: fullConversation.createdAt,
      updatedAt: fullConversation.updatedAt
    };

    // Invalidate conversations cache for all current participants (including new one)
    // so fetchConversations() returns fresh data instead of stale cached data
    const allParticipantIds = allParticipants.map(p => p.userId._id.toString());
    await invalidateCache(allParticipantIds.map(id => cacheKeys.userConversations(id)));

    // Emit socket event to all participants in the group
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('participant-added', {
      conversationId,
      participant: {
        _id: participant.userId._id,
        displayName: participant.userId.displayName,
        avatarUrl: participant.userId.avatarUrl,
        username: participant.userId.username
      }
    });

    // Emit socket event to the new participant specifically with full conversation data
    io.to(newParticipantId.toString()).emit('new-group', conversationForNewUser);
    
    // Make the new participant join the conversation room
    const userSockets = await io.in(newParticipantId.toString()).fetchSockets();
    if (userSockets.length > 0) {
      userSockets.forEach(socket => {
        socket.join(conversationId.toString());
      });
      console.log(`   ✅ New participant ${newUser.displayName} joined conversation room`);
    }

    res.status(200).json({
      success: true,
      message: 'Đã thêm thành viên vào nhóm',
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa thành viên khỏi nhóm
// @route   DELETE /api/conversation/:conversationId/participant/:userId
// @access  Private
export const removeParticipant = async (req, res, next) => {
  try {
    const { conversationId, userId: participantId } = req.params;
    const currentUserId = req.user._id;

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể xóa thành viên khỏi nhóm');
    }

    // Check permissions (must be admin)
    const isAdmin = conversation.isAdmin(currentUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Chỉ quản trị viên mới có thể xóa thành viên');
    }

    // Cannot remove creator
    if (participantId === conversation.createdBy.toString()) {
      throw new ForbiddenError('Không thể xóa người tạo nhóm');
    }

    // Find participant
    const participant = await Participant.findOne({
      conversationId,
      userId: participantId,
      leftAt: null
    });

    if (!participant) {
      throw new NotFoundError('Không tìm thấy thành viên trong nhóm');
    }

    // Remove participant (soft delete)
    await participant.leave();

    // Remove from admins if they are admin
    if (conversation.admins.includes(participantId)) {
      conversation.admins = conversation.admins.filter(
        adminId => adminId.toString() !== participantId
      );
      await conversation.save();
    }

    // Invalidate cache for all remaining members + removed member
    const remainingAfterRemove = await Participant.find({ conversationId, leftAt: null });
    const cacheIdsRemove = [
      ...remainingAfterRemove.map(p => p.userId.toString()),
      participantId.toString()
    ];
    await invalidateCache(cacheIdsRemove.map(id => cacheKeys.userConversations(id)));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('participant-removed', {
      conversationId,
      userId: participantId
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa thành viên khỏi nhóm'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Thêm quản trị viên
// @route   POST /api/conversation/:conversationId/admin
// @access  Private
export const addAdmin = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { userId: newAdminId } = req.body;
    const currentUserId = req.user._id;

    // Validate
    if (!newAdminId) {
      throw new ValidationError('Vui lòng cung cấp ID người dùng');
    }

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể thêm quản trị viên trong nhóm');
    }

    // Check permissions (must be admin)
    const isAdmin = conversation.isAdmin(currentUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Chỉ quản trị viên mới có thể thêm quản trị viên khác');
    }

    // Check if user is participant
    const isParticipant = await Participant.isParticipant(conversationId, newAdminId);
    if (!isParticipant) {
      throw new ValidationError('Người dùng phải là thành viên của nhóm');
    }

    // Check if already admin
    if (conversation.isAdmin(newAdminId)) {
      throw new ConflictError('Người dùng đã là quản trị viên');
    }

    // Add admin
    conversation.admins.push(newAdminId);
    await conversation.save();

    // Invalidate cache for all participants so fetchConversations() returns updated admins list
    const participantsForAdmin = await Participant.find({ conversationId, leftAt: null });
    await invalidateCache(participantsForAdmin.map(p => cacheKeys.userConversations(p.userId.toString())));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('admin-added', {
      conversationId,
      userId: newAdminId
    });

    res.status(200).json({
      success: true,
      message: 'Đã thêm quản trị viên'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa quản trị viên
// @route   DELETE /api/conversation/:conversationId/admin/:userId
// @access  Private
export const removeAdmin = async (req, res, next) => {
  try {
    const { conversationId, userId: adminId } = req.params;
    const currentUserId = req.user._id;

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể xóa quản trị viên trong nhóm');
    }

    // Check permissions (must be admin or creator)
    const isAdmin = conversation.isAdmin(currentUserId);
    const isCreator = conversation.createdBy.toString() === currentUserId.toString();
    
    if (!isAdmin && !isCreator) {
      throw new ForbiddenError('Chỉ quản trị viên hoặc người tạo nhóm mới có thể xóa quản trị viên');
    }

    // Cannot remove creator
    if (adminId === conversation.createdBy.toString()) {
      throw new ForbiddenError('Không thể xóa quyền quản trị viên của người tạo nhóm');
    }

    // Check if user is admin
    if (!conversation.isAdmin(adminId)) {
      throw new ValidationError('Người dùng không phải là quản trị viên');
    }

    // Remove admin
    conversation.admins = conversation.admins.filter(
      id => id.toString() !== adminId
    );
    await conversation.save();

    // Invalidate cache for all participants so fetchConversations() returns updated admins list
    const participantsForRemoveAdmin = await Participant.find({ conversationId, leftAt: null });
    await invalidateCache(participantsForRemoveAdmin.map(p => cacheKeys.userConversations(p.userId.toString())));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('admin-removed', {
      conversationId,
      userId: adminId
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa quản trị viên'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật thông tin nhóm
// @route   PUT /api/conversation/:conversationId/info
// @access  Private
export const updateGroupInfo = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { groupName, groupDescription, groupAvatar, groupAvatarId } = req.body;
    const currentUserId = req.user._id;

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể cập nhật thông tin nhóm');
    }

    // Check permissions
    if (conversation.settings?.onlyAdminsCanEditGroup === true) {
      const isAdmin = conversation.isAdmin(currentUserId);
      if (!isAdmin) {
        throw new ForbiddenError('Chỉ quản trị viên mới có thể chỉnh sửa thông tin nhóm');
      }
    } else {
      const isParticipant = await Participant.isParticipant(conversationId, currentUserId);
      if (!isParticipant) {
        throw new ForbiddenError('Bạn không phải là thành viên của nhóm này');
      }
    }

    // Update fields
    if (groupName !== undefined) {
      if (groupName.trim() === '') {
        throw new ValidationError('Tên nhóm không được để trống');
      }
      conversation.groupName = groupName.trim();
    }

    if (groupDescription !== undefined) {
      conversation.groupDescription = groupDescription.trim();
    }

    if (groupAvatar !== undefined) {
      conversation.groupAvatar = groupAvatar;
    }

    if (groupAvatarId !== undefined) {
      conversation.groupAvatarId = groupAvatarId;
    }

    await conversation.save();

    // Invalidate cache for all participants so they get updated group info
    const participantsForInfoUpdate = await Participant.find({ conversationId, leftAt: null });
    await invalidateCache(participantsForInfoUpdate.map(p => cacheKeys.userConversations(p.userId.toString())));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('group-info-updated', {
      conversationId,
      groupName: conversation.groupName,
      groupDescription: conversation.groupDescription,
      groupAvatar: conversation.groupAvatar
    });

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật thông tin nhóm',
      data: conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật cài đặt nhóm
// @route   PUT /api/conversation/:conversationId/settings
// @access  Private
export const updateGroupSettings = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { onlyAdminsCanSend, onlyAdminsCanEditGroup, allowMembersToInvite } = req.body;
    const currentUserId = req.user._id;

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể cập nhật cài đặt nhóm');
    }

    // Check permissions (must be admin)
    const isAdmin = conversation.isAdmin(currentUserId);
    if (!isAdmin) {
      throw new ForbiddenError('Chỉ quản trị viên mới có thể thay đổi cài đặt nhóm');
    }

    // Update settings
    if (onlyAdminsCanSend !== undefined) {
      conversation.settings.onlyAdminsCanSend = onlyAdminsCanSend;
    }

    if (onlyAdminsCanEditGroup !== undefined) {
      conversation.settings.onlyAdminsCanEditGroup = onlyAdminsCanEditGroup;
    }

    if (allowMembersToInvite !== undefined) {
      conversation.settings.allowMembersToInvite = allowMembersToInvite;
    }

    await conversation.save();

    // Invalidate cache for all participants so they get updated settings
    const participantsForSettings = await Participant.find({ conversationId, leftAt: null });
    await invalidateCache(participantsForSettings.map(p => cacheKeys.userConversations(p.userId.toString())));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('group-settings-updated', {
      conversationId,
      settings: conversation.settings
    });

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật cài đặt nhóm',
      data: conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Rời khỏi cuộc trò chuyện
// @route   POST /api/conversation/:conversationId/leave
// @access  Private
export const leaveConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Cannot leave direct conversation
    if (conversation.type === 'direct') {
      throw new ForbiddenError('Không thể rời khỏi cuộc trò chuyện trực tiếp. Vui lòng xóa cuộc trò chuyện.');
    }

    // Check if creator
    if (conversation.createdBy.toString() === userId.toString()) {
      throw new ForbiddenError('Người tạo nhóm không thể rời khỏi nhóm. Vui lòng chuyển quyền quản trị trước.');
    }

    // Find participant
    const participant = await Participant.findOne({
      conversationId,
      userId,
      leftAt: null
    });

    if (!participant) {
      throw new NotFoundError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Leave conversation
    await participant.leave();

    // Remove from admins if they are admin
    if (conversation.isAdmin(userId)) {
      conversation.admins = conversation.admins.filter(
        adminId => adminId.toString() !== userId.toString()
      );
      await conversation.save();
    }

    // Invalidate cache for all remaining members + the member who left
    const remainingAfterLeave = await Participant.find({ conversationId, leftAt: null });
    const cacheIdsLeave = [
      ...remainingAfterLeave.map(p => p.userId.toString()),
      userId.toString()
    ];
    await invalidateCache(cacheIdsLeave.map(id => cacheKeys.userConversations(id)));

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('user-left-group', {
      conversationId,
      userId: userId.toString()
    });

    res.status(200).json({
      success: true,
      message: 'Đã rời khỏi cuộc hội thoại'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa cuộc trò chuyện (cho bản thân)
// @route   DELETE /api/conversation/:conversationId
// @access  Private
export const deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check if user is participant
    const participant = await Participant.findOne({
      conversationId,
      userId,
      leftAt: null
    });

    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Soft delete for both direct and group conversations
    await participant.leave();

    res.status(200).json({
      success: true,
      message: 'Đã xóa cuộc trò chuyện'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Giải tán nhóm (xóa vĩnh viễn cho tất cả)
// @route   DELETE /api/conversation/:conversationId/disband
// @access  Private (chỉ creator)
export const disbandGroup = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Only for group conversations
    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể giải tán nhóm chat');
    }

    // Only creator can disband
    if (conversation.createdBy.toString() !== userId.toString()) {
      throw new ForbiddenError('Chỉ người tạo nhóm mới có thể giải tán nhóm');
    }

    // Get all participants BEFORE deleting so we can invalidate their caches
    const allParticipantsBeforeDelete = await Participant.find({ conversationId, leftAt: null });
    const allParticipantIds = allParticipantsBeforeDelete.map(p => p.userId.toString());

    // Invalidate conversations cache for every member so fetchConversations() returns fresh data
    await invalidateCache(allParticipantIds.map(id => cacheKeys.userConversations(id)));

    // Emit socket event before deleting
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('group-deleted', {
      conversationId
    });

    // Delete conversation and all related data
    await Participant.deleteMany({ conversationId });
    await Message.deleteMany({ conversationId });
    await conversation.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Đã giải tán nhóm'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clean up duplicate direct conversations (admin/maintenance endpoint)
// @route   POST /api/conversation/cleanup-duplicates
// @access  Private
export const cleanupDuplicateConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all user's direct conversations
    const participants = await Participant.find({
      userId,
      leftAt: null
    }).populate('conversationId');

    const directConversations = participants
      .filter(p => p.conversationId && p.conversationId.type === 'direct')
      .map(p => p.conversationId);

    // Group by participant pairs
    const conversationGroups = new Map();
    
    for (const convo of directConversations) {
      const allParticipants = await Participant.find({
        conversationId: convo._id,
        leftAt: null
      }).select('userId');

      const participantIds = allParticipants
        .map(p => p.userId.toString())
        .sort()
        .join('-');

      if (!conversationGroups.has(participantIds)) {
        conversationGroups.set(participantIds, []);
      }
      conversationGroups.get(participantIds).push(convo);
    }

    // Find and delete duplicates
    let deletedCount = 0;
    for (const [key, convos] of conversationGroups) {
      if (convos.length > 1) {
        // Sort by lastMessageAt, keep the most recent one
        convos.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });

        // Delete all except the first one (most recent)
        for (let i = 1; i < convos.length; i++) {
          const convoToDelete = convos[i];
          
          // Soft delete for this user
          await Participant.updateOne(
            { conversationId: convoToDelete._id, userId },
            { leftAt: new Date() }
          );
          
          deletedCount++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Đã dọn dẹp ${deletedCount} cuộc trò chuyện trùng lặp`,
      deletedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Ghim tin nhắn
// @route   POST /api/conversation/:conversationId/pin/:messageId
// @access  Private
export const pinMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check permissions
    if (conversation.type === 'group') {
      const isAdmin = conversation.isAdmin(userId);
      if (!isAdmin) {
        throw new ForbiddenError('Chỉ quản trị viên mới có thể ghim tin nhắn trong nhóm');
      }
    } else {
      const isParticipant = await Participant.isParticipant(conversationId, userId);
      if (!isParticipant) {
        throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
      }
    }

    // Check message exists
    const message = await Message.findOne({
      _id: messageId,
      conversationId,
      isDeleted: false
    });

    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check if already pinned
    if (conversation.pinnedMessages && conversation.pinnedMessages.includes(messageId)) {
      throw new ConflictError('Tin nhắn đã được ghim');
    }

    // Check pin limit (max 3 messages)
    if (conversation.pinnedMessages && conversation.pinnedMessages.length >= 3) {
      throw new ValidationError('Chỉ có thể ghim tối đa 3 tin nhắn');
    }

    // Pin message
    if (!conversation.pinnedMessages) {
      conversation.pinnedMessages = [];
    }
    conversation.pinnedMessages.push(messageId);
    await conversation.save();

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('message-pinned', {
      conversationId,
      messageId,
      pinnedMessages: conversation.pinnedMessages
    });

    res.status(200).json({
      success: true,
      message: 'Đã ghim tin nhắn'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bỏ ghim tin nhắn
// @route   DELETE /api/conversation/:conversationId/pin/:messageId
// @access  Private
export const unpinMessage = async (req, res, next) => {
  try {
    const { conversationId, messageId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check permissions
    if (conversation.type === 'group') {
      const isAdmin = conversation.isAdmin(userId);
      if (!isAdmin) {
        throw new ForbiddenError('Chỉ quản trị viên mới có thể bỏ ghim tin nhắn trong nhóm');
      }
    } else {
      const isParticipant = await Participant.isParticipant(conversationId, userId);
      if (!isParticipant) {
        throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
      }
    }

    // Check if message is pinned
    if (!conversation.pinnedMessages || !conversation.pinnedMessages.includes(messageId)) {
      throw new ValidationError('Tin nhắn chưa được ghim');
    }

    // Unpin message
    conversation.pinnedMessages = conversation.pinnedMessages.filter(
      id => id.toString() !== messageId
    );
    await conversation.save();

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('message-unpinned', {
      conversationId,
      messageId,
      pinnedMessages: conversation.pinnedMessages
    });

    res.status(200).json({
      success: true,
      message: 'Đã bỏ ghim tin nhắn'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cập nhật cài đặt thông báo
// @route   PUT /api/conversation/:conversationId/notification
// @access  Private
export const updateNotificationSettings = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { enabled, mentions, replies, muteUntil } = req.body;
    const userId = req.user._id;

    // Find participant
    const participant = await Participant.findOne({
      conversationId,
      userId,
      leftAt: null
    });

    if (!participant) {
      throw new NotFoundError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Update notification settings
    if (enabled !== undefined) {
      participant.notifications.enabled = enabled;
    }

    if (mentions !== undefined) {
      participant.notifications.mentions = mentions;
    }

    if (replies !== undefined) {
      participant.notifications.replies = replies;
    }

    // Handle mute
    if (muteUntil !== undefined) {
      if (muteUntil === null) {
        // Unmute
        participant.isMuted = false;
        participant.mutedUntil = null;
      } else if (muteUntil === 'forever') {
        // Mute forever
        participant.isMuted = true;
        participant.mutedUntil = null;
      } else {
        // Mute until specific time
        const muteDate = new Date(muteUntil);
        if (isNaN(muteDate.getTime())) {
          throw new ValidationError('Thời gian tắt thông báo không hợp lệ');
        }
        participant.isMuted = true;
        participant.mutedUntil = muteDate;
      }
    }

    await participant.save();

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật cài đặt thông báo',
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pin/Unpin conversation
// @route   PUT /api/conversation/:conversationId/pin
// @access  Private
export const togglePinConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Find participant
    const participant = await Participant.findOne({
      conversationId,
      userId,
      leftAt: null
    });

    if (!participant) {
      throw new NotFoundError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Toggle pin
    participant.isPinned = !participant.isPinned;
    if (participant.isPinned) {
      participant.pinnedAt = new Date();
    } else {
      participant.pinnedAt = null;
    }

    await participant.save();

    res.status(200).json({
      success: true,
      message: participant.isPinned ? 'Đã ghim cuộc trò chuyện' : 'Đã bỏ ghim cuộc trò chuyện',
      data: { isPinned: participant.isPinned }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tin nhắn của conversation
// @route   GET /api/conversation/:conversationId/messages
// @access  Private
export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is participant
    const isParticipant = await Participant.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Build query
    const query = {
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: userId }
    };

    // Add cursor for pagination
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // Get messages with sender info
    const messages = await Message.find(query)
      .populate('senderId', 'username displayName avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content senderId type',
        populate: {
          path: 'senderId',
          select: 'username displayName avatarUrl'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) + 1); // Get one extra to check if there are more

    // Check if there are more messages
    const hasMore = messages.length > parseInt(limit);
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    // Get next cursor (oldest message's createdAt)
    const nextCursor = hasMore && messages.length > 0 
      ? messages[messages.length - 1].createdAt.toISOString() 
      : null;

    // Transform messages to include sender object
    const transformedMessages = messages.reverse().map(msg => {
      const transformed = {
        _id: msg._id,
        conversationId: msg.conversationId,
        senderId: msg.senderId._id,
        sender: {
          _id: msg.senderId._id,
          displayName: msg.senderId.displayName,
          avatarUrl: msg.senderId.avatarUrl,
          username: msg.senderId.username
        },
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        fileMimeType: msg.fileMimeType,
        reactions: msg.reactions,
        isEdited: msg.isEdited,
        isDeleted: msg.isDeleted,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt
      };

      // Transform replyTo if exists
      if (msg.replyTo) {
        transformed.replyTo = {
          _id: msg.replyTo._id,
          content: msg.replyTo.content,
          type: msg.replyTo.type,
          sender: msg.replyTo.senderId ? {
            _id: msg.replyTo.senderId._id,
            displayName: msg.replyTo.senderId.displayName,
            avatarUrl: msg.replyTo.senderId.avatarUrl
          } : null
        };
      }

      return transformed;
    });

    res.status(200).json({
      success: true,
      messages: transformedMessages,
      nextCursor,
      hasMore
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đánh dấu conversation đã xem
// @route   PATCH /api/conversation/:conversationId/seen
// @access  Private
export const markConversationAsSeen = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Find participant
    const participant = await Participant.findOne({
      conversationId,
      userId,
      leftAt: null
    });

    if (!participant) {
      throw new NotFoundError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Mark as read
    await participant.markAsRead();

    // Get updated unread counts
    const allParticipants = await Participant.find({
      conversationId,
      leftAt: null
    });

    const unreadCounts = {};
    allParticipants.forEach(p => {
      unreadCounts[p.userId.toString()] = p.unreadCount || 0;
    });

    // Emit socket event to notify sender that message was seen
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('message-seen', {
      conversationId,
      seenBy: userId,
      unreadCounts
    });

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu đã xem'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tìm kiếm cuộc trò chuyện (bao gồm cả đã xóa)
// @route   GET /api/conversation/search
// @access  Private
export const searchConversations = async (req, res, next) => {
  try {
    const { query } = req.query;
    const userId = req.user._id;

    if (!query || query.trim() === '') {
      return res.status(200).json({
        success: true,
        conversations: []
      });
    }

    // Find all participants (including left ones) for this user
    const allParticipants = await Participant.find({
      userId
    }).populate({
      path: 'conversationId',
      populate: [
        {
          path: 'lastMessageSender',
          select: 'username displayName avatarUrl'
        },
        {
          path: 'createdBy',
          select: 'username displayName avatarUrl'
        },
        {
          path: 'admins',
          select: 'username displayName avatarUrl'
        }
      ]
    });

    // Filter and format conversations
    const conversations = await Promise.all(
      allParticipants
        .filter(p => p.conversationId) // Ensure conversation exists
        .map(async (participant) => {
          const conversation = participant.conversationId;
          
          // For direct conversations, search by other user's name
          if (conversation.type === 'direct') {
            const allConvoParticipants = await Participant.find({
              conversationId: conversation._id,
              leftAt: null
            }).populate('userId', 'username displayName avatarUrl status lastSeen bio');
            
            const otherParticipant = allConvoParticipants.find(
              p => p.userId._id.toString() !== userId.toString()
            );
            
            if (!otherParticipant) return null;
            
            const otherUser = otherParticipant.userId;
            const matchesSearch = otherUser.displayName?.toLowerCase().includes(query.toLowerCase()) ||
                                 otherUser.username?.toLowerCase().includes(query.toLowerCase());
            
            if (!matchesSearch) return null;
            
            return {
              _id: conversation._id,
              type: conversation.type,
              user: otherUser,
              participants: allConvoParticipants.map(p => p.userId),
              lastMessage: conversation.lastMessageContent ? {
                content: conversation.lastMessageContent,
                createdAt: conversation.lastMessageAt
              } : null,
              isHidden: !!participant.leftAt, // User has deleted this conversation
              leftAt: participant.leftAt
            };
          }
          
          // For group conversations, search by group name
          if (conversation.type === 'group') {
            const matchesSearch = conversation.groupName?.toLowerCase().includes(query.toLowerCase());
            
            if (!matchesSearch) return null;
            
            const allConvoParticipants = await Participant.find({
              conversationId: conversation._id,
              leftAt: null
            }).populate('userId', 'username displayName avatarUrl status lastSeen bio');
            
            return {
              _id: conversation._id,
              type: conversation.type,
              group: {
                name: conversation.groupName,
                avatar: conversation.groupAvatar,
                description: conversation.groupDescription
              },
              participants: allConvoParticipants.map(p => p.userId),
              createdBy: conversation.createdBy,
              admins: conversation.admins || [],
              lastMessage: conversation.lastMessageContent ? {
                content: conversation.lastMessageContent,
                createdAt: conversation.lastMessageAt
              } : null,
              isHidden: !!participant.leftAt,
              leftAt: participant.leftAt
            };
          }
          
          return null;
        })
    );

    // Filter out nulls
    const filteredConversations = conversations.filter(c => c !== null);

    res.status(200).json({
      success: true,
      conversations: filteredConversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Khôi phục cuộc trò chuyện đã xóa
// @route   POST /api/conversation/:conversationId/restore
// @access  Private
export const restoreConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Find participant (including left ones)
    const participant = await Participant.findOne({
      conversationId,
      userId
    });

    if (!participant) {
      throw new NotFoundError('Không tìm thấy cuộc trò chuyện');
    }

    if (!participant.leftAt) {
      throw new ValidationError('Cuộc trò chuyện chưa bị xóa');
    }

    // Restore conversation
    participant.leftAt = null;
    await participant.save();

    // Get full conversation data
    const conversation = await Conversation.findById(conversationId)
      .populate('createdBy', 'username displayName avatarUrl')
      .populate('admins', 'username displayName avatarUrl')
      .populate('lastMessageSender', 'username displayName avatarUrl');

    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Get all participants
    const allParticipants = await Participant.find({
      conversationId,
      leftAt: null
    }).populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Build unread counts
    const unreadCounts = {};
    allParticipants.forEach(p => {
      unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
    });

    // Format response
    let conversationResponse;
    
    if (conversation.type === 'direct') {
      const otherParticipant = allParticipants.find(
        p => p.userId._id.toString() !== userId.toString()
      );
      const otherUser = otherParticipant ? otherParticipant.userId : null;
      
      conversationResponse = {
        _id: conversation._id,
        type: conversation.type,
        user: otherUser,
        participants: allParticipants.map(p => p.userId),
        lastMessage: conversation.lastMessageContent ? {
          _id: conversation._id,
          content: conversation.lastMessageContent,
          createdAt: conversation.lastMessageAt,
          sender: conversation.lastMessageSender
        } : null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts,
        seenBy: [],
        isPinned: participant.isPinned,
        isMuted: participant.isMuted,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      };
    } else {
      conversationResponse = {
        _id: conversation._id,
        type: conversation.type,
        participants: allParticipants.map(p => p.userId),
        group: {
          name: conversation.groupName,
          avatar: conversation.groupAvatar,
          description: conversation.groupDescription
        },
        createdBy: conversation.createdBy?._id || conversation.createdBy,
        admins: conversation.admins || [],
        settings: conversation.settings,
        pinnedMessages: conversation.pinnedMessages || [],
        lastMessage: conversation.lastMessageContent ? {
          _id: conversation._id,
          content: conversation.lastMessageContent,
          createdAt: conversation.lastMessageAt,
          sender: conversation.lastMessageSender
        } : null,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts,
        seenBy: [],
        isPinned: participant.isPinned,
        isMuted: participant.isMuted,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      };
    }

    res.status(200).json({
      success: true,
      message: 'Đã khôi phục cuộc trò chuyện',
      data: conversationResponse
    });
  } catch (error) {
    next(error);
  }
};

// Helper function for Socket.IO - Get user's conversation IDs
export const getUserConversationsForSocketIO = async (userId) => {
  try {
    const participants = await Participant.find({
      userId: userId,
      leftAt: null,
    }).select('conversationId');
    
    return participants.map((p) => p.conversationId.toString());
  } catch (error) {
    console.error('Error getting user conversations for socket:', error);
    return [];
  }
};

// @desc    Tìm kiếm nhóm chat
// @route   GET /api/conversation/search-groups
// @access  Private
export const searchGroups = async (req, res, next) => {
  try {
    const { query } = req.query;
    const userId = req.user._id;

    if (!query || query.trim() === '') {
      return res.status(200).json({
        success: true,
        groups: []
      });
    }

    // Find groups by name
    const groups = await Conversation.find({
      type: 'group',
      groupName: { $regex: query, $options: 'i' }
    })
      .populate('createdBy', 'username displayName avatarUrl')
      .limit(20);

    // For each group, check if user is already a participant
    const groupsWithStatus = await Promise.all(
      groups.map(async (group) => {
        const isParticipant = await Participant.findOne({
          conversationId: group._id,
          userId,
          leftAt: null
        });

        // Get participant count
        const participantCount = await Participant.countDocuments({
          conversationId: group._id,
          leftAt: null
        });

        return {
          _id: group._id,
          name: group.groupName,
          avatar: group.groupAvatar,
          description: group.groupDescription,
          createdBy: group.createdBy,
          participantCount,
          isParticipant: !!isParticipant,
          createdAt: group.createdAt
        };
      })
    );

    res.status(200).json({
      success: true,
      groups: groupsWithStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tham gia nhóm chat (rejoin after leaving)
// @route   POST /api/conversation/:conversationId/rejoin
// @access  Private
export const rejoinGroup = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists and is group
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy nhóm');
    }

    if (conversation.type !== 'group') {
      throw new ForbiddenError('Chỉ có thể tham gia lại nhóm chat');
    }

    // Check if user was previously a participant
    const existingParticipant = await Participant.findOne({
      conversationId,
      userId
    });

    if (existingParticipant && !existingParticipant.leftAt) {
      throw new ConflictError('Bạn đã là thành viên của nhóm');
    }

    // Rejoin or create new participant
    if (existingParticipant) {
      existingParticipant.leftAt = null;
      existingParticipant.joinedAt = new Date();
      await existingParticipant.save();
    } else {
      await Participant.create({
        conversationId,
        userId
      });
    }

    // Get full conversation data
    const fullConversation = await Conversation.findById(conversationId)
      .populate('createdBy', 'username displayName avatarUrl')
      .populate('admins', 'username displayName avatarUrl')
      .populate('lastMessageSender', 'username displayName avatarUrl');

    const allParticipants = await Participant.find({
      conversationId,
      leftAt: null
    }).populate('userId', 'username displayName avatarUrl status lastSeen bio');

    // Build unread counts object
    const unreadCounts = {};
    allParticipants.forEach(p => {
      unreadCounts[p.userId._id.toString()] = p.unreadCount || 0;
    });

    // Format conversation
    const conversationResponse = {
      _id: fullConversation._id,
      type: fullConversation.type,
      participants: allParticipants.map(p => p.userId),
      group: {
        name: fullConversation.groupName,
        avatar: fullConversation.groupAvatar,
        description: fullConversation.groupDescription
      },
      createdBy: fullConversation.createdBy?._id || fullConversation.createdBy,
      admins: fullConversation.admins || [],
      settings: fullConversation.settings,
      pinnedMessages: fullConversation.pinnedMessages || [],
      lastMessage: fullConversation.lastMessageContent ? {
        _id: fullConversation._id,
        content: fullConversation.lastMessageContent,
        createdAt: fullConversation.lastMessageAt,
        sender: fullConversation.lastMessageSender
      } : null,
      lastMessageAt: fullConversation.lastMessageAt,
      unreadCounts,
      seenBy: [],
      isPinned: false,
      isMuted: false,
      createdAt: fullConversation.createdAt,
      updatedAt: fullConversation.updatedAt
    };

    // Emit socket event
    const { io } = await import('../socket/index.js');
    io.to(conversationId.toString()).emit('participant-added', {
      conversationId,
      participant: {
        _id: userId,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl,
        username: req.user.username
      }
    });

    res.status(200).json({
      success: true,
      message: 'Đã tham gia nhóm',
      data: conversationResponse
    });
  } catch (error) {
    next(error);
  }
};
