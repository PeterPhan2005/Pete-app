import express from 'express';
import {
  getActiveCall,
  getCallHistory,
  getUserCallHistory,
  getCallDetails
} from '../controllers/callController.js';

const router = express.Router();

// Get user's call history
router.get('/history', getUserCallHistory);

// Get active call in conversation
router.get('/conversation/:conversationId/active', getActiveCall);

// Get call history for conversation
router.get('/conversation/:conversationId/history', getCallHistory);

// Get call details
router.get('/:callId', getCallDetails);

export default router;
