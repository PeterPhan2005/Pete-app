import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true,
    index: true
  },
  // Group-specific fields
  groupName: {
    type: String,
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  groupAvatar: {
    type: String,
    default: null
  },
  groupAvatarId: {
    type: String, // Cloudinary ID for deletion
    default: null
  },
  groupDescription: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Last message info (for conversation list optimization)
  lastMessageContent: {
    type: String,
    default: null
  },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: null,
    index: true // For sorting conversation list
  },
  // Typing indicators
  currentlyTyping: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Pinned messages
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: []
  }],
  // Group settings
  settings: {
    onlyAdminsCanSend: {
      type: Boolean,
      default: false
    },
    onlyAdminsCanEditGroup: {
      type: Boolean,
      default: true
    },
    allowMembersToInvite: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
conversationSchema.index({ type: 1, lastMessageAt: -1 });
conversationSchema.index({ createdBy: 1 });

// Virtual for participant count
conversationSchema.virtual('participantCount', {
  ref: 'Participant',
  localField: '_id',
  foreignField: 'conversationId',
  count: true
});

// Method to update last message
conversationSchema.methods.updateLastMessage = async function(message) {
  this.lastMessageContent = message.content || '[File]';
  this.lastMessageSender = message.senderId;
  this.lastMessageAt = message.createdAt || new Date();
  await this.save();
};

// Method to add typing indicator
conversationSchema.methods.addTyping = async function(userId) {
  if (!this.currentlyTyping.includes(userId)) {
    this.currentlyTyping.push(userId);
    await this.save();
  }
};

// Method to remove typing indicator
conversationSchema.methods.removeTyping = async function(userId) {
  this.currentlyTyping = this.currentlyTyping.filter(id => !id.equals(userId));
  await this.save();
};

// Method to check if user is admin
conversationSchema.methods.isAdmin = function(userId) {
  if (this.type === 'direct') return false;
  return this.admins.some(adminId => adminId.equals(userId)) || 
         this.createdBy.equals(userId);
};

// Method to add admin
conversationSchema.methods.addAdmin = async function(userId) {
  if (this.type === 'direct') {
    throw new Error('Cannot add admin to direct conversation');
  }
  if (!this.admins.includes(userId)) {
    this.admins.push(userId);
    await this.save();
  }
};

// Method to remove admin
conversationSchema.methods.removeAdmin = async function(userId) {
  if (this.createdBy.equals(userId)) {
    throw new Error('Cannot remove creator as admin');
  }
  this.admins = this.admins.filter(id => !id.equals(userId));
  await this.save();
};

// Static method to find or create direct conversation
conversationSchema.statics.findOrCreateDirect = async function(userId1, userId2) {
  const Participant = mongoose.model('Participant');
  
  // Find existing direct conversation between these users (regardless of leftAt status)
  const existingConversation = await Participant.aggregate([
    {
      $match: {
        userId: { $in: [userId1, userId2] }
        // Remove leftAt: null to find all conversations, even deleted ones
      }
    },
    {
      $group: {
        _id: '$conversationId',
        userIds: { $push: '$userId' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: 2,
        userIds: { $all: [userId1, userId2] }
      }
    }
  ]);
  
  if (existingConversation.length > 0) {
    const conversationId = existingConversation[0]._id;
    
    // Reactivate participants who have left (restore deleted conversation)
    await Participant.updateMany(
      {
        conversationId,
        userId: { $in: [userId1, userId2] },
        leftAt: { $ne: null }
      },
      {
        $set: {
          leftAt: null,
          unreadCount: 0,
          joinedAt: new Date()
        }
      }
    );
    
    return await this.findById(conversationId);
  }
  
  // Create new direct conversation
  const conversation = await this.create({
    type: 'direct'
  });
  
  // Create participants
  await Participant.create([
    { conversationId: conversation._id, userId: userId1, role: 'member' },
    { conversationId: conversation._id, userId: userId2, role: 'member' }
  ]);
  
  return conversation;
};

// Static method to create group conversation
conversationSchema.statics.createGroup = async function(groupName, creatorId, memberIds, groupDescription = '', groupAvatar = null) {
  const conversation = await this.create({
    type: 'group',
    groupName,
    groupDescription,
    groupAvatar,
    createdBy: creatorId,
    admins: [creatorId] // Creator is always admin
  });
  
  // Create participants
  const Participant = mongoose.model('Participant');
  const participants = memberIds.map(userId => ({
    conversationId: conversation._id,
    userId,
    role: userId.toString() === creatorId.toString() ? 'owner' : 'member'
  }));
  
  await Participant.insertMany(participants);
  
  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
