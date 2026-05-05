import express from 'express';
import {
  addFriend,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  getAllFriend,
  getFriendsRequest,
  getAllFriendRequests,
  getSentFriendRequests,
  unFriend,
  blockFriend,
  unblockFriend,
  getBlockedFriends,
  getFriendshipStatus
} from '../controllers/friendController.js';

const router = express.Router();

// Friend request routes
router.post('/add', addFriend); // Gửi lời mời kết bạn
router.get('/requests/all', getAllFriendRequests); // Lấy tất cả lời mời (sent + received)
router.get('/requests', getFriendsRequest); // Lấy lời mời nhận được
router.get('/requests/sent', getSentFriendRequests); // Lấy lời mời đã gửi
router.post('/accept/:requestId', acceptFriendRequest); // Chấp nhận lời mời
router.post('/decline/:requestId', declineFriendRequest); // Từ chối lời mời
router.delete('/cancel/:requestId', cancelFriendRequest); // Hủy lời mời đã gửi

// Friend management routes
router.get('/all', getAllFriend); // Lấy danh sách bạn bè
router.delete('/unfriend/:friendId', unFriend); // Hủy kết bạn

// Block management routes
router.post('/block/:friendId', blockFriend); // Chặn bạn bè
router.post('/unblock/:friendId', unblockFriend); // Bỏ chặn
router.get('/blocked', getBlockedFriends); // Danh sách đã chặn

// Status check route
router.get('/status/:userId', getFriendshipStatus); // Kiểm tra trạng thái với user

export default router;
