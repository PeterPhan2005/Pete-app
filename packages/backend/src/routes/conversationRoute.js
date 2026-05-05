import express from 'express';
import {
  createDirectConversation,
  createGroupConversation,
  getConversations,
  getConversationDetails,
  getConversationMessages,
  markConversationAsSeen,
  addParticipant,
  removeParticipant,
  addAdmin,
  removeAdmin,
  updateGroupInfo,
  updateGroupSettings,
  leaveConversation,
  deleteConversation,
  disbandGroup,
  cleanupDuplicateConversations,
  pinMessage,
  unpinMessage,
  updateNotificationSettings,
  togglePinConversation,
  searchGroups,
  rejoinGroup,
  searchConversations,
  restoreConversation
} from '../controllers/conversationController.js';
import { cacheMiddleware, cacheKeys } from '../middlewares/cacheMiddleware.js';

const router = express.Router();

// Conversation creation
router.post('/direct', createDirectConversation); // Tạo conversation 1-1
router.post('/group', createGroupConversation); // Tạo nhóm

// Conversation management
// Cache conversations list for 2 minutes
router.get('/', cacheMiddleware(120, (req) => cacheKeys.userConversations(req.user._id)), getConversations);
router.get('/search', searchConversations); // Tìm kiếm conversations (bao gồm đã xóa)
router.get('/search-groups', searchGroups); // Tìm kiếm nhóm
// Cache conversation details for 5 minutes
router.get('/:conversationId', cacheMiddleware(300, (req) => cacheKeys.conversation(req.params.conversationId)), getConversationDetails);
// Cache messages for 1 minute (short TTL since messages change frequently)
router.get('/:conversationId/messages', cacheMiddleware(60, (req) => {
  const { cursor = 'latest' } = req.query;
  return cacheKeys.conversationMessages(req.params.conversationId, cursor);
}), getConversationMessages);
router.patch('/:conversationId/seen', markConversationAsSeen); // Đánh dấu đã xem
router.delete('/:conversationId', deleteConversation); // Xóa conversation (cho bản thân)
router.delete('/:conversationId/disband', disbandGroup); // Giải tán nhóm (xóa vĩnh viễn)
router.post('/:conversationId/leave', leaveConversation); // Rời khỏi conversation
router.post('/:conversationId/rejoin', rejoinGroup); // Tham gia lại nhóm
router.post('/:conversationId/restore', restoreConversation); // Khôi phục conversation đã xóa
router.put('/:conversationId/pin', togglePinConversation); // Pin/Unpin conversation

// Cleanup
router.post('/cleanup-duplicates', cleanupDuplicateConversations); // Dọn dẹp duplicate conversations

// Group management - Participants
router.post('/:conversationId/participant', addParticipant); // Thêm thành viên
router.delete('/:conversationId/participant/:userId', removeParticipant); // Xóa thành viên

// Group management - Admins
router.post('/:conversationId/admin', addAdmin); // Thêm admin
router.delete('/:conversationId/admin/:userId', removeAdmin); // Xóa admin

// Group settings
router.put('/:conversationId/info', updateGroupInfo); // Cập nhật thông tin nhóm
router.put('/:conversationId/settings', updateGroupSettings); // Cập nhật cài đặt nhóm

// Message pinning
router.post('/:conversationId/pin/:messageId', pinMessage); // Ghim tin nhắn
router.delete('/:conversationId/pin/:messageId', unpinMessage); // Bỏ ghim tin nhắn

// Notification settings
router.put('/:conversationId/notification', updateNotificationSettings); // Cập nhật thông báo

export default router;