import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Participant from '../models/Participant.js';
import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errorHandler.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { invalidateCache, cacheKeys } from '../middlewares/cacheMiddleware.js';
import { publishToQueue, QUEUES } from '../config/rabbitmq.js';

// @desc    Upload file to Cloudinary
// @route   POST /api/message/upload
// @access  Private
export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('Vui lòng chọn file để upload');
    }

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      throw new ValidationError('Kích thước file không được vượt quá 5MB');
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'chat-files',
      resource_type: 'auto', // Automatically detect file type
    });

    res.status(200).json({
      success: true,
      message: 'Upload file thành công',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        resourceType: result.resource_type,
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Gửi tin nhắn (cả direct và group)
// @route   POST /api/message/send
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content, type = 'text', fileUrl, fileName, fileSize, fileMimeType, replyTo, mentions } = req.body;
    const senderId = req.user._id;

    // Validate
    if (!conversationId) {
      throw new ValidationError('Vui lòng cung cấp ID cuộc hội thoại');
    }

    if (!content && !fileUrl) {
      throw new ValidationError('Tin nhắn phải có nội dung hoặc file đính kèm');
    }

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is participant
    const participant = await Participant.findOne({
      conversationId,
      userId: senderId,
      leftAt: null
    });

    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // For direct conversations, check if blocked
    if (conversation.type === 'direct') {
      const allParticipants = await Participant.find({
        conversationId,
        leftAt: null
      }).populate('userId', 'displayName');
      
      const otherParticipant = allParticipants.find(
        p => p.userId._id.toString() !== senderId.toString()
      );
      
      if (otherParticipant) {
        const Friend = (await import('../models/Friend.js')).default;
        
        // Check if current user blocked the other
        const iBlockedThem = await Friend.findOne({
          userId: senderId,
          friendId: otherParticipant.userId._id,
          isBlocked: true
        });
        
        if (iBlockedThem) {
          throw new ForbiddenError(`Bạn đã chặn ${otherParticipant.userId.displayName}`);
        }
        
        // Check if other user blocked current user
        const theyBlockedMe = await Friend.findOne({
          userId: otherParticipant.userId._id,
          friendId: senderId,
          isBlocked: true
        });
        
        if (theyBlockedMe) {
          throw new ForbiddenError(`Bạn đã bị chặn bởi ${otherParticipant.userId.displayName}`);
        }
      }
    }

    // Check group permissions (chỉ check khi setting được bật)
    if (conversation.type === 'group' && conversation.settings?.onlyAdminsCanSend === true) {
      const isAdmin = conversation.isAdmin(senderId);
      if (!isAdmin) {
        throw new ForbiddenError('Chỉ quản trị viên mới có thể gửi tin nhắn trong nhóm này');
      }
    }

    // Create message
    const message = await Message.create({
      conversationId,
      senderId,
      content,
      type,
      fileUrl,
      fileName,
      fileSize,
      fileMimeType,
      replyTo,
      mentions: mentions || []
    });

    // Populate sender info
    await message.populate('senderId', 'username displayName avatarUrl');

    // CRITICAL: Update conversation's lastMessage fields in DB so conversation list shows newest message
    await conversation.updateLastMessage(message);
    
    if (replyTo) {
      await message.populate({
        path: 'replyTo',
        select: 'content senderId type',
        populate: {
          path: 'senderId',
          select: 'displayName avatarUrl username'
        }
      });
    }

    // Get updated conversation with unread counts (only active participants)
    const allParticipants = await Participant.find({
      conversationId,
      leftAt: null
    });

    const unreadCounts = {};
    allParticipants.forEach(p => {
      unreadCounts[p.userId.toString()] = p.unreadCount || 0;
    });

    // Emit socket event to conversation room (all connected users in this conversation)
    const { io } = await import('../socket/index.js');
    
    const serverInstance = process.env.INSTANCE_ID || 'unknown';
    console.log(`\n${'*'.repeat(80)}`);
    console.log(`📤 [${serverInstance}] EMITTING NEW MESSAGE`);
    console.log(`   👤 Sender: ${message.senderId.displayName}`);
    console.log(`   💬 Conversation: ${conversationId}`);
    console.log(`   📝 Content: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`);
    console.log(`   📊 Type: ${message.type}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`${'*'.repeat(80)}\n`);
    
    io.to(conversationId.toString()).emit('new-message', {
      message: {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId._id,
        sender: {
          _id: message.senderId._id,
          displayName: message.senderId.displayName,
          avatarUrl: message.senderId.avatarUrl,
          username: message.senderId.username
        },
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        fileMimeType: message.fileMimeType,
        replyTo: message.replyTo ? {
          _id: message.replyTo._id,
          content: message.replyTo.content,
          sender: message.replyTo.senderId ? {
            _id: message.replyTo.senderId._id,
            displayName: message.replyTo.senderId.displayName,
            avatarUrl: message.replyTo.senderId.avatarUrl,
            username: message.replyTo.senderId.username
          } : undefined
        } : undefined,
        createdAt: message.createdAt,
        isOwn: false // Will be set by client based on their userId
      },
      conversation: {
        _id: conversation._id,
        lastMessage: {
          _id: message._id,
          content: message.content,
          senderId: message.senderId._id,
          createdAt: message.createdAt
        },
        lastMessageAt: message.createdAt,
        unreadCounts
      },
      unreadCounts
    });

    // Invalidate cache for all participants
    const participantIds = allParticipants.map(p => p.userId.toString());
    const cacheInvalidations = [
      cacheKeys.conversation(conversationId),
      `${cacheKeys.conversationMessages(conversationId)}*`, // Invalidate all message pages
      ...participantIds.map(id => cacheKeys.userConversations(id))
    ];
    await invalidateCache(cacheInvalidations);

    // Publish to RabbitMQ for async processing
    // 1. Log message to analytics
    await publishToQueue(QUEUES.MESSAGE_LOGGING, {
      messageId: message._id.toString(),
      conversationId: conversationId.toString(),
      senderId: senderId.toString(),
      type: message.type,
      timestamp: message.createdAt
    });

    // 2. Process image if it's an image message
    if (type === 'image' && fileUrl) {
      await publishToQueue(QUEUES.IMAGE_PROCESSING, {
        imageUrl: fileUrl,
        userId: senderId.toString(),
        conversationId: conversationId.toString(),
        operations: ['thumbnail', 'compress']
      });
    }

    // 3. Track user activity
    await publishToQueue(QUEUES.USER_ACTIVITY, {
      userId: senderId.toString(),
      activityType: 'message_sent',
      metadata: {
        conversationId: conversationId.toString(),
        messageType: type
      },
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Đã gửi tin nhắn thành công',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy danh sách tin nhắn của conversation
// @route   GET /api/message/:conversationId
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { before, after, limit = 50 } = req.query;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is or was a participant (allow access even if they left)
    const participant = await Participant.findOne({
      conversationId,
      userId
    });
    
    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Get messages
    const messages = await Message.getMessages(conversationId, {
      userId,
      before: before ? new Date(before) : null,
      after: after ? new Date(after) : null,
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Chỉnh sửa tin nhắn
// @route   PUT /api/message/:messageId
// @access  Private
export const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    // Validate
    if (!content || content.trim() === '') {
      throw new ValidationError('Nội dung tin nhắn không được để trống');
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check ownership
    if (message.senderId.toString() !== userId.toString()) {
      throw new ForbiddenError('Bạn chỉ có thể chỉnh sửa tin nhắn của mình');
    }

    // Check if already deleted
    if (message.isDeleted) {
      throw new ValidationError('Không thể chỉnh sửa tin nhắn đã bị xóa');
    }

    // Edit message
    await message.edit(content);

    // Populate sender info
    await message.populate('senderId', 'username displayName avatarUrl');

    // Emit socket event to conversation room
    const { io } = await import('../socket/index.js');
    io.to(message.conversationId.toString()).emit('message-edited', {
      messageId: message._id,
      conversationId: message.conversationId,
      content: message.content,
      isEdited: true,
      editedAt: message.updatedAt
    });

    res.status(200).json({
      success: true,
      message: 'Đã chỉnh sửa tin nhắn thành công',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa tin nhắn cho bản thân
// @route   DELETE /api/message/:messageId/for-me
// @access  Private
export const deleteMessageForMe = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Delete for user
    await message.deleteForUser(userId);

    // Emit socket event to user's personal room
    const { io } = await import('../socket/index.js');
    io.to(userId.toString()).emit('message-deleted-for-me', {
      messageId: message._id,
      conversationId: message.conversationId
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa tin nhắn cho bạn'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa tin nhắn cho tất cả mọi người
// @route   DELETE /api/message/:messageId/for-everyone
// @access  Private
export const deleteMessageForEveryone = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check ownership
    if (message.senderId.toString() !== userId.toString()) {
      throw new ForbiddenError('Bạn chỉ có thể xóa tin nhắn của mình cho mọi người');
    }

    // Delete for everyone (xóa vĩnh viễn)
    await message.deleteForEveryone();

    // Emit socket event to conversation room
    const { io } = await import('../socket/index.js');
    io.to(message.conversationId.toString()).emit('message-deleted-for-everyone', {
      messageId: message._id,
      conversationId: message.conversationId
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa tin nhắn cho mọi người'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Thêm reaction vào tin nhắn
// @route   POST /api/message/:messageId/react
// @access  Private
export const addReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    // Validate
    if (!emoji) {
      throw new ValidationError('Vui lòng chọn emoji');
    }

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check if message is deleted
    if (message.isDeleted) {
      throw new ValidationError('Không thể reaction tin nhắn đã bị xóa');
    }

    // Check user is participant
    const isParticipant = await Participant.isParticipant(message.conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Add reaction
    await message.addReaction(userId, emoji);

    // Emit socket event to conversation room
    const { io } = await import('../socket/index.js');
    io.to(message.conversationId.toString()).emit('message-reaction-added', {
      messageId: message._id,
      conversationId: message.conversationId,
      reactions: message.reactions,
      reactionSummary: message.reactionSummary
    });

    res.status(200).json({
      success: true,
      message: 'Đã thêm reaction',
      data: {
        reactions: message.reactions,
        reactionSummary: message.reactionSummary
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Xóa reaction khỏi tin nhắn
// @route   DELETE /api/message/:messageId/react
// @access  Private
export const removeReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.query;
    const userId = req.user._id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Remove reaction
    await message.removeReaction(userId, emoji);

    // Emit socket event to conversation room
    const { io } = await import('../socket/index.js');
    io.to(message.conversationId.toString()).emit('message-reaction-removed', {
      messageId: message._id,
      conversationId: message.conversationId,
      reactions: message.reactions,
      reactionSummary: message.reactionSummary
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa reaction',
      data: {
        reactions: message.reactions,
        reactionSummary: message.reactionSummary
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đánh dấu tin nhắn đã đọc
// @route   POST /api/message/:messageId/read
// @access  Private
export const markMessageAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check user is participant
    const isParticipant = await Participant.isParticipant(message.conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Mark as read
    await message.markAsRead(userId);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tin nhắn đã đọc'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Đánh dấu tất cả tin nhắn trong conversation đã đọc
// @route   POST /api/message/:conversationId/read-all
// @access  Private
export const markAllMessagesAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
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

    // Mark all as read
    await Message.markAllAsRead(conversationId, userId);

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả tin nhắn đã đọc'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Chuyển tiếp tin nhắn
// @route   POST /api/message/:messageId/forward
// @access  Private
export const forwardMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { conversationIds } = req.body;
    const userId = req.user._id;

    // Validate
    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      throw new ValidationError('Vui lòng chọn ít nhất một cuộc hội thoại để chuyển tiếp');
    }

    // Find original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      throw new NotFoundError('Không tìm thấy tin nhắn');
    }

    // Check if message is deleted
    if (originalMessage.isDeleted) {
      throw new ValidationError('Không thể chuyển tiếp tin nhắn đã bị xóa');
    }

    // Forward to each conversation
    const forwardedMessages = [];
    const { io } = await import('../socket/index.js');
    
    for (const conversationId of conversationIds) {
      // Check conversation exists
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        continue; // Skip invalid conversations
      }

      // Check user is participant
      const isParticipant = await Participant.isParticipant(conversationId, userId);
      if (!isParticipant) {
        continue; // Skip conversations user is not part of
      }

      // Create forwarded message
      const forwardedMessage = await Message.create({
        conversationId,
        senderId: userId,
        content: originalMessage.content,
        type: originalMessage.type,
        fileUrl: originalMessage.fileUrl,
        fileName: originalMessage.fileName,
        fileSize: originalMessage.fileSize,
        fileMimeType: originalMessage.fileMimeType,
        forwardedFrom: originalMessage._id
      });

      await forwardedMessage.populate('senderId', 'username displayName avatarUrl');
      forwardedMessages.push(forwardedMessage);

      // Update conversation's lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessageAt: forwardedMessage.createdAt,
        $set: {
          'lastMessage._id': forwardedMessage._id,
          'lastMessage.content': forwardedMessage.content,
          'lastMessage.createdAt': forwardedMessage.createdAt,
          'lastMessage.sender._id': userId,
        }
      });

      // Get updated conversation with unread counts
      const allParticipants = await Participant.find({
        conversationId,
        leftAt: null
      });

      const unreadCounts = {};
      allParticipants.forEach(p => {
        unreadCounts[p.userId.toString()] = p.unreadCount || 0;
      });

      // Emit socket event to conversation room
      io.to(conversationId.toString()).emit('new-message', {
        message: {
          _id: forwardedMessage._id,
          conversationId: forwardedMessage.conversationId,
          senderId: forwardedMessage.senderId._id,
          sender: {
            _id: forwardedMessage.senderId._id,
            displayName: forwardedMessage.senderId.displayName,
            avatarUrl: forwardedMessage.senderId.avatarUrl,
            username: forwardedMessage.senderId.username
          },
          content: forwardedMessage.content,
          type: forwardedMessage.type,
          fileUrl: forwardedMessage.fileUrl,
          fileName: forwardedMessage.fileName,
          createdAt: forwardedMessage.createdAt,
          isOwn: false // Will be set by client based on their userId
        },
        conversation: {
          _id: conversation._id,
          lastMessage: {
            _id: forwardedMessage._id,
            content: forwardedMessage.content,
            senderId: forwardedMessage.senderId._id,
            createdAt: forwardedMessage.createdAt
          },
          lastMessageAt: forwardedMessage.createdAt,
          unreadCounts
        },
        unreadCounts
      });
    }

    res.status(201).json({
      success: true,
      message: `Đã chuyển tiếp tin nhắn tới ${forwardedMessages.length} cuộc hội thoại`,
      data: forwardedMessages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Tìm kiếm tin nhắn trong conversation
// @route   GET /api/message/:conversationId/search
// @access  Private
export const searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { query, limit = 20 } = req.query;
    const userId = req.user._id;

    // Validate
    if (!query || query.trim() === '') {
      throw new ValidationError('Vui lòng nhập từ khóa tìm kiếm');
    }

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is or was a participant (allow access even if they left)
    const participant = await Participant.findOne({
      conversationId,
      userId
    });
    
    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Search messages
    const messages = await Message.find({
      conversationId,
      isDeleted: false,
      deletedFor: { $ne: userId },
      $text: { $search: query }
    })
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
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy tin nhắn được ghim trong conversation
// @route   GET /api/message/:conversationId/pinned
// @access  Private
export const getPinnedMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is or was a participant (allow access even if they left)
    const participant = await Participant.findOne({
      conversationId,
      userId
    });
    
    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Get pinned messages (from conversation model)
    const pinnedMessageIds = (conversation.pinnedMessages || []).map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );
    
    const pinnedMessages = await Message.find({
      _id: { $in: pinnedMessageIds },
      isDeleted: false,
      deletedFor: { $ne: userId }
    })
      .populate('senderId', 'username displayName avatarUrl')
      .populate({
        path: 'replyTo',
        select: 'content senderId type',
        populate: {
          path: 'senderId',
          select: 'username displayName avatarUrl'
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: pinnedMessages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Lấy file media trong conversation
// @route   GET /api/message/:conversationId/media
// @access  Private
export const getMediaMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { type = 'image', limit = 20, skip = 0 } = req.query;
    const userId = req.user._id;

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Không tìm thấy cuộc hội thoại');
    }

    // Check user is or was a participant (allow access even if they left)
    const participant = await Participant.findOne({
      conversationId,
      userId
    });
    
    if (!participant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    // Get media messages
    const messages = await Message.find({
      conversationId,
      type: { $in: ['image', 'video', 'audio', 'file'] },
      isDeleted: false,
      deletedFor: { $ne: userId }
    })
      .populate('senderId', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      conversationId,
      type: { $in: ['image', 'video', 'audio', 'file'] },
      isDeleted: false,
      deletedFor: { $ne: userId }
    });

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + messages.length < total
      }
    });
  } catch (error) {
    next(error);
  }
};
