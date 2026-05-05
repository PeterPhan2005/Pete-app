import { Server } from "socket.io";
import http from "http";
import express from "express";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { socketAuthMiddleware } from "../middlewares/socketMiddleware.js";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import User from "../models/User.js";

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"]
  },
});

// Setup Redis adapter for Socket.IO (for scaling across multiple instances)
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Redis adapter connected for Socket.IO');
  })
  .catch((err) => {
    console.error('❌ Redis adapter connection failed:', err);
  });

// Handle Redis errors
pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

// Apply authentication middleware
io.use(socketAuthMiddleware);

// Track online users - Map<userId, socketId>
const onlineUsers = new Map();

// Socket.IO connection handler
io.on("connection", async (socket) => {
  try {
    const user = socket.user; // Populated by socketAuthMiddleware
    const serverInstance = process.env.INSTANCE_ID || process.pid;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ [${serverInstance}] USER CONNECTED`);
    console.log(`   👤 User: ${user.displayName}`);
    console.log(`   🆔 UserID: ${user._id}`);
    console.log(`   🔌 SocketID: ${socket.id}`);
    console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(80)}\n`);

    // Add user to online users map
    onlineUsers.set(user._id.toString(), socket.id);
    
    // Update user status to online
    await User.findByIdAndUpdate(user._id, { status: 'online' });
    
    // Broadcast updated online users list to all clients
    io.emit("online-users", Array.from(onlineUsers.keys()));

    // Auto-join user's conversations
    const conversationIds = await getUserConversationsForSocketIO(user._id);
    conversationIds.forEach((conversationId) => {
      socket.join(conversationId);
      console.log(`👥 [${serverInstance}] User ${user.displayName} joined conversation: ${conversationId}`);
    });

    // Join user's personal room (for direct notifications)
    socket.join(user._id.toString());

    // Handle manual conversation join (when user creates/joins new conversation)
    socket.on("join-conversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`\n➕ [${serverInstance}] JOIN CONVERSATION`);
      console.log(`   👤 User: ${user.displayName}`);
      console.log(`   💬 Conversation: ${conversationId}`);
      console.log(`   ⏰ Time: ${new Date().toLocaleString()}\n`);
    });

    // Handle leave conversation
    socket.on("leave-conversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(`➖ User ${user.displayName} left conversation: ${conversationId}`);
    });

    // Handle typing indicator
    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit("user-typing", {
        conversationId,
        userId: user._id,
        userName: user.displayName,
        isTyping
      });
    });

    // ==================== WEBRTC SIGNALING EVENTS ====================
    
    // Call: Initiate call
    socket.on("call:initiate", async ({ conversationId, callType, callerId, receiverId }) => {
      try {
        const Call = (await import('../models/Call.js')).default;
        
        // Create call record
        const call = await Call.create({
          conversationId,
          callerId,
          type: callType,
          status: 'ringing',
          participants: [
            { userId: callerId, status: 'joined' },
            { userId: receiverId, status: 'ringing' }
          ]
        });

        await call.populate('callerId', 'username displayName avatarUrl');
        
        // Notify receiver
        io.to(receiverId.toString()).emit("call:incoming", {
          callId: call._id,
          roomId: call.roomId,
          conversationId,
          caller: {
            _id: call.callerId._id,
            displayName: call.callerId.displayName,
            avatarUrl: call.callerId.avatarUrl
          },
          callType
        });

        // Confirm to caller
        socket.emit("call:initiated", {
          callId: call._id,
          roomId: call.roomId
        });

        console.log(`📞 Call initiated: ${callerId} → ${receiverId}`);
      } catch (error) {
        console.error("Error initiating call:", error);
        socket.emit("call:error", { message: "Failed to initiate call" });
      }
    });

    // Call: Accept call
    socket.on("call:accept", async ({ callId, userId }) => {
      try {
        const Call = (await import('../models/Call.js')).default;
        const call = await Call.findById(callId);
        
        if (!call) {
          socket.emit("call:error", { message: "Call not found" });
          return;
        }

        await call.updateParticipantStatus(userId, 'joined');
        await call.start();

        // Notify caller that call was accepted
        io.to(call.callerId.toString()).emit("call:accepted", {
          callId: call._id,
          roomId: call.roomId,
          userId
        });

        console.log(`✅ Call accepted: ${callId}`);
      } catch (error) {
        console.error("Error accepting call:", error);
        socket.emit("call:error", { message: "Failed to accept call" });
      }
    });

    // Call: Decline call
    socket.on("call:decline", async ({ callId, userId }) => {
      try {
        const Call = (await import('../models/Call.js')).default;
        const call = await Call.findById(callId);
        
        if (!call) return;

        await call.decline(userId);

        // Notify caller
        io.to(call.callerId.toString()).emit("call:declined", {
          callId: call._id,
          userId
        });

        console.log(`❌ Call declined: ${callId}`);
      } catch (error) {
        console.error("Error declining call:", error);
      }
    });

    // Call: End call
    socket.on("call:end", async ({ callId, userId }) => {
      try {
        const Call = (await import('../models/Call.js')).default;

        const call = await Call.findById(callId).populate('callerId', 'displayName avatarUrl');

        if (!call) return;

        // Trigger end — post-save hook in Call model creates the message automatically
        await call.end('completed');

        // Emit call:ended to all participants (UI dialog close)
        // The new-message is emitted by Call.post('save') hook
        call.participants.forEach(participant => {
          io.to(participant.userId.toString()).emit("call:ended", {
            callId: call._id,
            endedBy: userId
          });
        });

        // Also emit to caller (in case caller is not in participants)
        if (!call.participants.some(p => p.userId.equals(call.callerId))) {
          io.to(call.callerId._id.toString()).emit("call:ended", {
            callId: call._id,
            endedBy: userId
          });
        }

        console.log(`📴 Call ended: ${callId}`);
      } catch (error) {
        console.error("Error ending call:", error);
      }
    });

    // WebRTC: Offer
    socket.on("webrtc:offer", ({ callId, offer, to }) => {
      io.to(to.toString()).emit("webrtc:offer", {
        callId,
        offer,
        from: user._id.toString()
      });
      console.log(`📤 WebRTC offer sent: ${user._id} → ${to}`);
    });

    // WebRTC: Answer
    socket.on("webrtc:answer", ({ callId, answer, to }) => {
      io.to(to.toString()).emit("webrtc:answer", {
        callId,
        answer,
        from: user._id.toString()
      });
      console.log(`📥 WebRTC answer sent: ${user._id} → ${to}`);
    });

    // WebRTC: ICE Candidate
    socket.on("webrtc:ice-candidate", ({ callId, candidate, to }) => {
      io.to(to.toString()).emit("webrtc:ice-candidate", {
        callId,
        candidate,
        from: user._id.toString()
      });
    });

    // ==================== END WEBRTC EVENTS ====================

    // Handle disconnect
    socket.on("disconnect", () => {
      const serverInstance = process.env.INSTANCE_ID || process.pid;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`❌ [${serverInstance}] USER DISCONNECTED`);
      console.log(`   👤 User: ${user.displayName}`);
      console.log(`   🆔 UserID: ${user._id}`);
      console.log(`   ⏰ Time: ${new Date().toLocaleString()}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Remove user from online users
      onlineUsers.delete(user._id.toString());
      
      // Update lastSeen in database
      User.findByIdAndUpdate(user._id, { 
        status: 'offline',
        lastSeen: new Date() 
      }).catch(err => console.error('Error updating lastSeen:', err));
      
      // Broadcast updated online users list
      io.emit("online-users", Array.from(onlineUsers.keys()));
    });

  } catch (error) {
    console.error("Socket connection error:", error);
    socket.disconnect();
  }
});

export { io, app, server, onlineUsers };
