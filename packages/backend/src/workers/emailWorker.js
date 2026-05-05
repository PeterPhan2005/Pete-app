import { consumeFromQueue, QUEUES } from '../config/rabbitmq.js';

/**
 * Process email notification tasks
 * @param {object} data - Email data
 */
const processEmailNotification = async (data) => {
  const { type, recipient, subject, body, metadata } = data;
  
  console.log(`📧 Processing email notification:`);
  console.log(`   Type: ${type}`);
  console.log(`   To: ${recipient}`);
  console.log(`   Subject: ${subject}`);
  
  // Simulate email sending (in production, use nodemailer or SendGrid)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // In production, you would do:
  // await sendEmail({ to: recipient, subject, html: body });
  
  console.log(`✅ Email sent successfully to ${recipient}`);
  
  // Log to database or analytics
  if (metadata) {
    console.log(`   Metadata:`, metadata);
  }
};

/**
 * Start email worker
 */
export const startEmailWorker = async () => {
  console.log('🚀 Starting Email Worker...');
  
  await consumeFromQueue(QUEUES.EMAIL_NOTIFICATIONS, async (data) => {
    await processEmailNotification(data);
  });
  
  console.log('✅ Email Worker started');
};
