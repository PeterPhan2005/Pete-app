import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  status: {
    type: String,
    enum: ['ringing', 'ongoing', 'ended', 'missed', 'declined', 'failed'],
    default: 'ringing',
    index: true
  },
  // WebRTC room ID
  roomId: {
    type: String,
    required: true,
    unique: true,
    default: () => `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  // Participants tracking
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['invited', 'ringing', 'joined', 'left', 'declined', 'missed'],
      default: 'invited'
    },
    joinedAt: {
      type: Date,
      default: null
    },
    leftAt: {
      type: Date,
      default: null
    },
    // Duration in seconds
    duration: {
      type: Number,
      default: 0
    }
  }],
  // Call timing
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  // Total duration in seconds
  duration: {
    type: Number,
    default: 0
  },
  // Recording
  isRecorded: {
    type: Boolean,
    default: false
  },
  recordingUrl: {
    type: String,
    default: null
  },
  recordingId: {
    type: String,
    default: null
  },
  // End reason
  endReason: {
    type: String,
    enum: ['completed', 'caller_ended', 'participant_ended', 'timeout', 'error', 'network_error'],
    default: null
  },
  // Quality metrics
  qualityMetrics: {
    averageAudioQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: null
    },
    averageVideoQuality: {
      type: Number,
      min: 0,
      max: 5,
      default: null
    },
    networkIssues: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes for queries
callSchema.index({ conversationId: 1, status: 1, startedAt: -1 });
callSchema.index({ callerId: 1, startedAt: -1 });
callSchema.index({ 'participants.userId': 1, startedAt: -1 });

// Virtual to check if call is active
callSchema.virtual('isActive').get(function() {
  return ['ringing', 'ongoing'].includes(this.status);
});

// Virtual to get active participants
callSchema.virtual('activeParticipants').get(function() {
  return this.participants.filter(p => p.status === 'joined');
});

// Method to add participant
callSchema.methods.addParticipant = async function(userId, status = 'invited') {
  // Check if participant already exists
  const existingParticipant = this.participants.find(p => p.userId.equals(userId));
  
  if (!existingParticipant) {
    this.participants.push({
      userId,
      status,
      joinedAt: status === 'joined' ? new Date() : null
    });
    await this.save();
  }
  
  return this;
};

// Method to update participant status
callSchema.methods.updateParticipantStatus = async function(userId, status) {
  const participant = this.participants.find(p => p.userId.equals(userId));
  
  if (participant) {
    participant.status = status;
    
    if (status === 'joined') {
      participant.joinedAt = new Date();
      
      // If this is the first participant joining, start the call
      if (this.status === 'ringing') {
        this.status = 'ongoing';
        this.startedAt = new Date();
      }
    } else if (status === 'left') {
      participant.leftAt = new Date();
      
      // Calculate participant duration
      if (participant.joinedAt) {
        participant.duration = Math.floor(
          (participant.leftAt - participant.joinedAt) / 1000
        );
      }
      
      // Check if all participants have left
      const activeParticipants = this.participants.filter(
        p => p.status === 'joined'
      );
      
      if (activeParticipants.length === 0 && this.status === 'ongoing') {
        await this.end('completed');
      }
    }
    
    await this.save();
  }
  
  return this;
};

// Method to start call
callSchema.methods.start = async function() {
  if (this.status === 'ringing') {
    this.status = 'ongoing';
    this.startedAt = new Date();
    await this.save();
  }
  return this;
};

// Method to end call
callSchema.methods.end = async function(reason = 'completed') {
  if (this.status !== 'ended') {
    this.status = 'ended';
    this.endedAt = new Date();
    this.endReason = reason;
    
    // Calculate total duration
    if (this.startedAt) {
      this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    }
    
    // Update all joined participants to left
    this.participants.forEach(participant => {
      if (participant.status === 'joined') {
        participant.status = 'left';
        participant.leftAt = this.endedAt;
        
        if (participant.joinedAt) {
          participant.duration = Math.floor(
            (participant.leftAt - participant.joinedAt) / 1000
          );
        }
      } else if (participant.status === 'ringing' || participant.status === 'invited') {
        participant.status = 'missed';
      }
    });
    
    await this.save();
  }
  
  return this;
};

// Method to decline call
callSchema.methods.decline = async function(userId) {
  const participant = this.participants.find(p => p.userId.equals(userId));
  
  if (participant) {
    participant.status = 'declined';
    await this.save();
    
    // If caller declined, end the call
    if (userId.equals(this.callerId)) {
      await this.end('caller_ended');
    }
    
    // If all participants declined, end the call
    const activeOrRinging = this.participants.filter(
      p => ['invited', 'ringing', 'joined'].includes(p.status)
    );
    
    if (activeOrRinging.length === 0) {
      await this.end('declined');
    }
  }
  
  return this;
};

// Method to update quality metrics
callSchema.methods.updateQualityMetrics = async function(metrics) {
  if (metrics.audioQuality !== undefined) {
    this.qualityMetrics.averageAudioQuality = metrics.audioQuality;
  }
  if (metrics.videoQuality !== undefined) {
    this.qualityMetrics.averageVideoQuality = metrics.videoQuality;
  }
  if (metrics.networkIssues !== undefined) {
    this.qualityMetrics.networkIssues = (this.qualityMetrics.networkIssues || 0) + 1;
  }
  
  await this.save();
  return this;
};

// Static method to get active call in conversation
callSchema.statics.getActiveCall = async function(conversationId) {
  return await this.findOne({
    conversationId,
    status: { $in: ['ringing', 'ongoing'] }
  })
    .populate('callerId', 'username displayName avatarUrl')
    .populate('participants.userId', 'username displayName avatarUrl');
};

// Static method to get user's call history
callSchema.statics.getUserCallHistory = async function(userId, options = {}) {
  const { 
    page = 1, 
    limit = 20,
    status = null,
    type = null
  } = options;
  
  const query = {
    $or: [
      { callerId: userId },
      { 'participants.userId': userId }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  if (type) {
    query.type = type;
  }
  
  return await this.find(query)
    .populate('callerId', 'username displayName avatarUrl')
    .populate('participants.userId', 'username displayName avatarUrl')
    .populate('conversationId', 'type groupName')
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to get conversation call history
callSchema.statics.getConversationCallHistory = async function(conversationId, options = {}) {
  const { 
    page = 1, 
    limit = 20,
    type = null
  } = options;
  
  const query = { conversationId };
  
  if (type) {
    query.type = type;
  }
  
  return await this.find(query)
    .populate('callerId', 'username displayName avatarUrl')
    .populate('participants.userId', 'username displayName avatarUrl')
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Auto-end calls that have been ringing for too long (2 minutes)
callSchema.statics.autoEndStaleCalls = async function() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  const staleCalls = await this.find({
    status: 'ringing',
    createdAt: { $lt: twoMinutesAgo }
  });
  
  for (const call of staleCalls) {
    await call.end('timeout');
  }
  
  return staleCalls.length;
};

// Post save hook to create call ended message
callSchema.post('save', async function(doc) {
  if (doc.status === 'ended' && doc.endedAt) {
    const Message = mongoose.model('Message');
    
    // Populate caller info if not already populated
    if (!doc.populated('callerId')) {
      await doc.populate('callerId', 'username displayName avatarUrl');
    }
    
    // Create call ended message with metadata
    const message = await Message.create({
      conversationId: doc.conversationId,
      senderId: doc.callerId._id || doc.callerId,
      content: '', // Empty content for call messages
      type: 'call',
      callMetadata: {
        callId: doc._id,
        callType: doc.type,
        duration: doc.duration,
        endReason: doc.endReason,
        caller: {
          _id: doc.callerId._id || doc.callerId,
          displayName: doc.callerId.displayName || 'Unknown',
          avatarUrl: doc.callerId.avatarUrl
        }
      }
    });

    // Emit socket event to conversation room
    const { io } = await import('../socket/index.js');
    
    // Populate sender info for socket event
    await message.populate('senderId', 'username displayName avatarUrl');
    
    io.to(doc.conversationId.toString()).emit('new-message', {
      message: {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId._id,
        sender: {
          _id: message.senderId._id,
          displayName: message.senderId.displayName,
          avatarUrl: message.senderId.avatarUrl,
          username: message.senderId.username
        },
        content: message.content,
        type: message.type,
        callMetadata: message.callMetadata,
        createdAt: message.createdAt,
        isOwn: false // Will be set by client based on their userId
      }
    });
  }
});

const Call = mongoose.model('Call', callSchema);

export default Call;
