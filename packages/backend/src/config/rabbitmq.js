import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

let connection = null;
let channel = null;

// Queue names
export const QUEUES = {
  EMAIL_NOTIFICATIONS: 'email_notifications',
  IMAGE_PROCESSING: 'image_processing',
  MESSAGE_LOGGING: 'message_logging',
  USER_ACTIVITY: 'user_activity'
};

/**
 * Connect to RabbitMQ
 */
export const connectRabbitMQ = async () => {
  try {
    console.log('🐰 Connecting to RabbitMQ...');
    
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Create queues
    for (const queueName of Object.values(QUEUES)) {
      await channel.assertQueue(queueName, {
        durable: true // Queue survives broker restart
      });
      console.log(`✅ Queue created: ${queueName}`);
    }
    
    console.log('✅ RabbitMQ connected successfully');
    
    // Handle connection errors
    connection.on('error', (err) => {
      console.error('❌ RabbitMQ connection error:', err);
    });
    
    connection.on('close', () => {
      console.log('⚠️  RabbitMQ connection closed');
    });
    
    return { connection, channel };
  } catch (error) {
    console.error('❌ Failed to connect to RabbitMQ:', error);
    throw error;
  }
};

/**
 * Publish message to queue
 * @param {string} queueName - Queue name
 * @param {object} data - Data to send
 */
export const publishToQueue = async (queueName, data) => {
  try {
    if (!channel) {
      console.error('❌ RabbitMQ channel not initialized');
      return false;
    }
    
    const message = JSON.stringify(data);
    const sent = channel.sendToQueue(
      queueName,
      Buffer.from(message),
      {
        persistent: true // Message survives broker restart
      }
    );
    
    if (sent) {
      console.log(`📤 Published to ${queueName}:`, data);
      return true;
    } else {
      console.error(`❌ Failed to publish to ${queueName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error publishing to ${queueName}:`, error);
    return false;
  }
};

/**
 * Consume messages from queue
 * @param {string} queueName - Queue name
 * @param {Function} callback - Callback function to process message
 */
export const consumeFromQueue = async (queueName, callback) => {
  try {
    if (!channel) {
      console.error('❌ RabbitMQ channel not initialized');
      return;
    }
    
    console.log(`👂 Listening to queue: ${queueName}`);
    
    await channel.consume(
      queueName,
      async (msg) => {
        if (msg) {
          try {
            const data = JSON.parse(msg.content.toString());
            console.log(`📥 Received from ${queueName}:`, data);
            
            // Process message
            await callback(data);
            
            // Acknowledge message
            channel.ack(msg);
            console.log(`✅ Processed message from ${queueName}`);
          } catch (error) {
            console.error(`❌ Error processing message from ${queueName}:`, error);
            // Reject and requeue message
            channel.nack(msg, false, true);
          }
        }
      },
      {
        noAck: false // Manual acknowledgment
      }
    );
  } catch (error) {
    console.error(`❌ Error consuming from ${queueName}:`, error);
  }
};

/**
 * Close RabbitMQ connection
 */
export const closeRabbitMQ = async () => {
  try {
    if (channel) {
      await channel.close();
    }
    if (connection) {
      await connection.close();
    }
    console.log('✅ RabbitMQ connection closed');
  } catch (error) {
    console.error('❌ Error closing RabbitMQ:', error);
  }
};

/**
 * Get channel (for direct use)
 */
export const getChannel = () => channel;

/**
 * Get connection (for direct use)
 */
export const getConnection = () => connection;
