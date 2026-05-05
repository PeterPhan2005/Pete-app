import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['member', 'admin', 'owner'],
    default: 'member'
  },
  lastReadAt: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // User-specific settings
  isMuted: {
    type: Boolean,
    default: false
  },
  mutedUntil: {
    type: Date,
    default: null
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  // Notification settings
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    mentions: {
      type: Boolean,
      default: true
    },
    replies: {
      type: Boolean,
      default: true
    }
  },
  // Custom nickname in this conversation
  nickname: {
    type: String,
    maxlength: [50, 'Nickname cannot exceed 50 characters'],
    default: null
  },
  // Timestamps
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // Using custom timestamps
});

// Compound unique index to prevent duplicate participants
participantSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

// Index for finding user's conversations
participantSchema.index({ userId: 1, leftAt: 1 });

// Index for finding conversation participants
participantSchema.index({ conversationId: 1, leftAt: 1 });

// Index for pinned conversations
participantSchema.index({ userId: 1, isPinned: 1, pinnedAt: -1 });

// Virtual to check if muted
participantSchema.virtual('isCurrentlyMuted').get(function() {
  if (!this.isMuted) return false;
  if (!this.mutedUntil) return true;
  return this.mutedUntil > new Date();
});

// Virtual to check if active (not left)
participantSchema.virtual('isActive').get(function() {
  return this.leftAt === null;
});

// Method to mark as read
participantSchema.methods.markAsRead = async function(messageTimestamp = new Date()) {
  this.lastReadAt = messageTimestamp;
  this.unreadCount = 0;
  await this.save();
};

// Method to increment unread count
participantSchema.methods.incrementUnread = async function() {
  // Don't increment if muted
  if (this.isCurrentlyMuted) return;
  
  this.unreadCount += 1;
  await this.save();
};

// Method to pin conversation
participantSchema.methods.pin = async function() {
  this.isPinned = true;
  this.pinnedAt = new Date();
  await this.save();
};

// Method to unpin conversation
participantSchema.methods.unpin = async function() {
  this.isPinned = false;
  this.pinnedAt = null;
  await this.save();
};

// Method to mute conversation
participantSchema.methods.mute = async function(duration = null) {
  this.isMuted = true;
  if (duration) {
    this.mutedUntil = new Date(Date.now() + duration);
  } else {
    this.mutedUntil = null; // Mute indefinitely
  }
  await this.save();
};

// Method to unmute conversation
participantSchema.methods.unmute = async function() {
  this.isMuted = false;
  this.mutedUntil = null;
  await this.save();
};

// Method to leave conversation
participantSchema.methods.leave = async function() {
  this.leftAt = new Date();
  await this.save();
  
  // If group conversation, check if all members left
  const Conversation = mongoose.model('Conversation');
  const conversation = await Conversation.findById(this.conversationId);
  
  if (conversation && conversation.type === 'group') {
    const activeParticipants = await this.constructor.countDocuments({
      conversationId: this.conversationId,
      leftAt: null
    });
    
    // If no active participants, mark conversation as inactive
    if (activeParticipants === 0) {
      // Optional: Delete conversation or mark as archived
    }
  }
};

// Method to rejoin conversation
participantSchema.methods.rejoin = async function() {
  this.leftAt = null;
  this.joinedAt = new Date();
  await this.save();
};

// Static method to get user's conversations
participantSchema.statics.getUserConversations = async function(userId, options = {}) {
  const { 
    includeLeft = false, 
    onlyPinned = false,
    page = 1, 
    limit = 20 
  } = options;
  
  const query = { userId };
  
  if (!includeLeft) {
    query.leftAt = null;
  }
  
  if (onlyPinned) {
    query.isPinned = true;
  }
  
  return await this.find(query)
    .populate({
      path: 'conversationId',
      populate: [
        {
          path: 'lastMessageSender',
          select: 'username displayName avatarUrl'
        },
        {
          path: 'createdBy',
          select: 'username displayName avatarUrl'
        },
        {
          path: 'admins',
          select: 'username displayName avatarUrl'
        }
      ]
    })
    .sort({ isPinned: -1, pinnedAt: -1, 'conversationId.lastMessageAt': -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to get conversation participants
participantSchema.statics.getConversationParticipants = async function(conversationId, options = {}) {
  const { includeLeft = false, role = null } = options;
  
  const query = { conversationId };
  
  if (!includeLeft) {
    query.leftAt = null;
  }
  
  if (role) {
    query.role = role;
  }
  
  return await this.find(query)
    .populate('userId', 'username displayName avatarUrl status lastSeen bio')
    .sort({ role: 1, joinedAt: 1 });
};

// Static method to check if user is participant
participantSchema.statics.isParticipant = async function(conversationId, userId) {
  const participant = await this.findOne({
    conversationId,
    userId,
    leftAt: null
  });
  
  return !!participant;
};

const Participant = mongoose.model('Participant', participantSchema);

export default Participant;
