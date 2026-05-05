import express from 'express';
import multer from 'multer';
import {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  addReaction,
  removeReaction,
  markMessageAsRead,
  markAllMessagesAsRead,
  forwardMessage,
  searchMessages,
  getPinnedMessages,
  getMediaMessages,
  uploadFile
} from '../controllers/messageController.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Upload route
router.post('/upload', upload.single('file'), uploadFile); // Upload file

// Message CRUD routes
router.post('/send', sendMessage); // Gửi tin nhắn
router.get('/:conversationId', getMessages); // Lấy tin nhắn của conversation
router.put('/:messageId', editMessage); // Chỉnh sửa tin nhắn

// Delete routes
router.delete('/:messageId/for-me', deleteMessageForMe); // Xóa cho bản thân
router.delete('/:messageId/for-everyone', deleteMessageForEveryone); // Xóa cho mọi người

// Reaction routes
router.post('/:messageId/react', addReaction); // Thêm reaction
router.delete('/:messageId/react', removeReaction); // Xóa reaction

// Read receipt routes
router.post('/:messageId/read', markMessageAsRead); // Đánh dấu 1 tin nhắn đã đọc
router.post('/:conversationId/read-all', markAllMessagesAsRead); // Đánh dấu tất cả đã đọc

// Advanced features
router.post('/:messageId/forward', forwardMessage); // Chuyển tiếp tin nhắn
router.get('/:conversationId/search', searchMessages); // Tìm kiếm tin nhắn
router.get('/:conversationId/pinned', getPinnedMessages); // Lấy tin nhắn ghim
router.get('/:conversationId/media', getMediaMessages); // Lấy file media

export default router;