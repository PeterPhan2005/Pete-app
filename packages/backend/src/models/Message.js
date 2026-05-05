import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: [5000, 'Message content cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video', 'system', 'call'],
    default: 'text',
    required: true
  },
  // File attachments
  fileUrl: {
    type: String,
    default: null
  },
  fileId: {
    type: String, // Cloudinary/S3 ID for deletion
    default: null
  },
  fileName: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  fileMimeType: {
    type: String,
    default: null
  },
  // Reply feature
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
    index: true
  },
  // Forward feature
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Mentions
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Read receipts
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Reactions
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Delete feature (support "delete for me" and "delete for everyone")
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isDeleted: {
    type: Boolean,
    default: false // True = deleted for everyone
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Edit feature
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Call metadata (for call ended messages)
  callMetadata: {
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Call'
    },
    callType: {
      type: String,
      enum: ['audio', 'video']
    },
    duration: {
      type: Number, // in seconds
      default: 0
    },
    endReason: {
      type: String,
      enum: ['completed', 'caller_ended', 'participant_ended', 'timeout', 'error', 'network_error', 'declined']
    },
    caller: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      displayName: String,
      avatarUrl: String
    }
  },
  // Metadata
  metadata: {
    linkPreview: {
      url: String,
      title: String,
      description: String,
      image: String
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  }
}, {
  timestamps: true
});

// Compound index for pagination
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Index for finding replies
messageSchema.index({ replyTo: 1 });

// Index for mentions
messageSchema.index({ mentions: 1 });

// Virtual to get reaction summary
messageSchema.virtual('reactionSummary').get(function() {
  const summary = {};
  this.reactions.forEach(reaction => {
    if (!summary[reaction.emoji]) {
      summary[reaction.emoji] = { count: 0, users: [] };
    }
    summary[reaction.emoji].count += 1;
    summary[reaction.emoji].users.push(reaction.userId);
  });
  return summary;
});

// Method to mark as read by user
messageSchema.methods.markAsRead = async function(userId) {
  // Check if already read
  const alreadyRead = this.readBy.some(read => read.userId.equals(userId));
  
  if (!alreadyRead) {
    this.readBy.push({ userId, readAt: new Date() });
    await this.save();
    
    // Update participant's unread count
    const Participant = mongoose.model('Participant');
    const participant = await Participant.findOne({
      conversationId: this.conversationId,
      userId
    });
    
    if (participant) {
      await participant.markAsRead(this.createdAt);
    }
  }
};

// Method to add reaction
messageSchema.methods.addReaction = async function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  
  // Add new reaction
  this.reactions.push({ userId, emoji, createdAt: new Date() });
  await this.save();
};

// Method to remove reaction
messageSchema.methods.removeReaction = async function(userId, emoji = null) {
  if (emoji) {
    this.reactions = this.reactions.filter(
      r => !(r.userId.equals(userId) && r.emoji === emoji)
    );
  } else {
    // Remove all reactions from this user
    this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  }
  await this.save();
};

// Method to edit message
messageSchema.methods.edit = async function(newContent) {
  // Save to edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
  
  // Update conversation's last message if this is the latest
  const Conversation = mongoose.model('Conversation');
  const conversation = await Conversation.findById(this.conversationId);
  
  if (conversation && conversation.lastMessageSender.equals(this.senderId)) {
    const latestMessage = await this.constructor.findOne({
      conversationId: this.conversationId,
      isDeleted: false
    }).sort({ createdAt: -1 });
    
    if (latestMessage && latestMessage._id.equals(this._id)) {
      await conversation.updateLastMessage(this);
    }
  }
};

// Method to delete for user
messageSchema.methods.deleteForUser = async function(userId) {
  if (!this.deletedFor.includes(userId)) {
    this.deletedFor.push(userId);
    await this.save();
  }
};

// Method to delete for everyone
messageSchema.methods.deleteForEveryone = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = null;
  this.fileUrl = null;
  await this.save();
  
  // Update conversation's last message
  const Conversation = mongoose.model('Conversation');
  const conversation = await Conversation.findById(this.conversationId);
  
  if (conversation) {
    const latestMessage = await this.constructor.findOne({
      conversationId: this.conversationId,
      isDeleted: false
    }).sort({ createdAt: -1 });
    
    if (latestMessage) {
      await conversation.updateLastMessage(latestMessage);
    } else {
      conversation.lastMessageContent = null;
      conversation.lastMessageSender = null;
      conversation.lastMessageAt = null;
      await conversation.save();
    }
  }
};

// Static method to get messages with pagination
messageSchema.statics.getMessages = async function(conversationId, options = {}) {
  const { 
    userId = null,
    before = null, 
    after = null, 
    limit = 50 
  } = options;
  
  const query = { 
    conversationId,
    isDeleted: false
  };
  
  // Filter out messages deleted for this user
  if (userId) {
    query.deletedFor = { $ne: userId };
  }
  
  if (before) {
    query.createdAt = { $lt: before };
  } else if (after) {
    query.createdAt = { $gt: after };
  }
  
  return await this.find(query)
    .populate('senderId', 'username displayName avatarUrl')
    .populate({
      path: 'replyTo',
      select: 'content senderId type',
      populate: {
        path: 'senderId',
        select: 'username displayName avatarUrl'
      }
    })
    .populate('reactions.userId', 'username displayName avatarUrl')
    .sort({ createdAt: before ? -1 : 1 })
    .limit(limit);
};

// Static method to mark all messages as read
messageSchema.statics.markAllAsRead = async function(conversationId, userId) {
  await this.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId }
    },
    {
      $push: {
        readBy: {
          userId,
          readAt: new Date()
        }
      }
    }
  );
  
  // Update participant's unread count
  const Participant = mongoose.model('Participant');
  const participant = await Participant.findOne({
    conversationId,
    userId
  });
  
  if (participant) {
    await participant.markAsRead();
  }
};

// Post save hook to update conversation's last message
messageSchema.post('save', async function(doc) {
  if (!doc.isDeleted) {
    const Conversation = mongoose.model('Conversation');
    const conversation = await Conversation.findById(doc.conversationId);
    
    if (conversation) {
      await conversation.updateLastMessage(doc);
      
      // Update unread counts for participants
      const Participant = mongoose.model('Participant');
      
      if (conversation.type === 'direct') {
        // For direct conversations, increment unread for ALL participants (even those who left)
        // But DO NOT auto-restore them - they must manually reopen the conversation
        const allParticipants = await Participant.find({
          conversationId: doc.conversationId,
          userId: { $ne: doc.senderId }
        });
        
        for (const participant of allParticipants) {
          // Increment unread count (even if they left)
          // This way when they reopen, they'll see the unread count
          await participant.incrementUnread();
        }
      } else {
        // For group conversations, only increment for active participants
        const participants = await Participant.find({
          conversationId: doc.conversationId,
          userId: { $ne: doc.senderId },
          leftAt: null
        });
        
        for (const participant of participants) {
          await participant.incrementUnread();
        }
      }
    }
  }
});

const Message = mongoose.model('Message', messageSchema);

export default Message;
