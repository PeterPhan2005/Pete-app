import Call from '../models/Call.js';
import Conversation from '../models/Conversation.js';
import Participant from '../models/Participant.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errorHandler.js';

// @desc    Get active call in conversation
// @route   GET /api/call/conversation/:conversationId/active
// @access  Private
export const getActiveCall = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Check if user is participant
    const isParticipant = await Participant.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    const call = await Call.getActiveCall(conversationId);

    res.status(200).json({
      success: true,
      data: call
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call history for conversation
// @route   GET /api/call/conversation/:conversationId/history
// @access  Private
export const getCallHistory = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;

    // Check if user is participant
    const isParticipant = await Participant.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenError('Bạn không phải là thành viên của cuộc hội thoại này');
    }

    const calls = await Call.getConversationCallHistory(conversationId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type
    });

    res.status(200).json({
      success: true,
      data: calls
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's call history
// @route   GET /api/call/history
// @access  Private
export const getUserCallHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status, type } = req.query;

    const calls = await Call.getUserCallHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type
    });

    res.status(200).json({
      success: true,
      data: calls
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call details
// @route   GET /api/call/:callId
// @access  Private
export const getCallDetails = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const userId = req.user._id;

    const call = await Call.findById(callId)
      .populate('callerId', 'username displayName avatarUrl')
      .populate('participants.userId', 'username displayName avatarUrl')
      .populate('conversationId', 'type groupName');

    if (!call) {
      throw new NotFoundError('Không tìm thấy cuộc gọi');
    }

    // Check if user is participant
    const isParticipant = call.participants.some(
      p => p.userId._id.toString() === userId.toString()
    ) || call.callerId._id.toString() === userId.toString();

    if (!isParticipant) {
      throw new ForbiddenError('Bạn không có quyền xem cuộc gọi này');
    }

    res.status(200).json({
      success: true,
      data: call
    });
  } catch (error) {
    next(error);
  }
};
