import { consumeFromQueue, QUEUES } from '../config/rabbitmq.js';

/**
 * Track user activity
 * @param {object} data - Activity data
 */
const trackActivity = async (data) => {
  const { userId, activityType, metadata, timestamp } = data;
  
  console.log(`📊 Tracking activity:`);
  console.log(`   User: ${userId}`);
  console.log(`   Type: ${activityType}`);
  console.log(`   Time: ${new Date(timestamp).toISOString()}`);
  
  // Simulate activity tracking
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In production, you would:
  // - Update user activity log
  // - Calculate user engagement score
  // - Trigger recommendations
  // - Update last active timestamp
  // - Track feature usage
  
  console.log(`✅ Activity tracked successfully`);
};

/**
 * Start activity worker
 */
export const startActivityWorker = async () => {
  console.log('🚀 Starting Activity Worker...');
  
  await consumeFromQueue(QUEUES.USER_ACTIVITY, async (data) => {
    await trackActivity(data);
  });
  
  console.log('✅ Activity Worker started');
};
