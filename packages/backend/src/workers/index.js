import { connectRabbitMQ, closeRabbitMQ } from '../config/rabbitmq.js';
import { startEmailWorker } from './emailWorker.js';
import { startImageWorker } from './imageWorker.js';
import { startActivityWorker } from './activityWorker.js';
import { startMessageLogWorker } from './messageLogWorker.js';

/**
 * Start all workers
 */
export const startAllWorkers = async () => {
  try {
    console.log('🚀 Starting all RabbitMQ workers...');
    
    // Connect to RabbitMQ
    await connectRabbitMQ();
    
    // Start all workers
    await Promise.all([
      startEmailWorker(),
      startImageWorker(),
      startActivityWorker(),
      startMessageLogWorker()
    ]);
    
    console.log('✅ All workers started successfully');
  } catch (error) {
    console.error('❌ Failed to start workers:', error);
    throw error;
  }
};

/**
 * Stop all workers
 */
export const stopAllWorkers = async () => {
  try {
    console.log('🛑 Stopping all workers...');
    await closeRabbitMQ();
    console.log('✅ All workers stopped');
  } catch (error) {
    console.error('❌ Error stopping workers:', error);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  await stopAllWorkers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  await stopAllWorkers();
  process.exit(0);
});
