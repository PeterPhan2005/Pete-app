import mongoose from 'mongoose';

const friendSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  friendId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  blockedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // Using custom createdAt
});

// Compound unique index to prevent duplicate friendships
friendSchema.index({ userId: 1, friendId: 1 }, { unique: true });

// Index for finding all friends of a user
friendSchema.index({ userId: 1, isBlocked: 1 });

// Method to block friend
friendSchema.methods.block = async function(blockerId) {
  this.isBlocked = true;
  this.blockedBy = blockerId;
  this.blockedAt = new Date();
  await this.save();
  
  // Also block the reverse friendship
  const reverseFriendship = await this.constructor.findOne({
    userId: this.friendId,
    friendId: this.userId
  });
  
  if (reverseFriendship) {
    reverseFriendship.isBlocked = true;
    reverseFriendship.blockedBy = blockerId;
    reverseFriendship.blockedAt = new Date();
    await reverseFriendship.save();
  }
  
  return this;
};

// Method to unblock friend
friendSchema.methods.unblock = async function() {
  this.isBlocked = false;
  this.blockedBy = null;
  this.blockedAt = null;
  await this.save();
  
  // Also unblock the reverse friendship
  const reverseFriendship = await this.constructor.findOne({
    userId: this.friendId,
    friendId: this.userId
  });
  
  if (reverseFriendship) {
    reverseFriendship.isBlocked = false;
    reverseFriendship.blockedBy = null;
    reverseFriendship.blockedAt = null;
    await reverseFriendship.save();
  }
  
  return this;
};

// Static method to get all friends of a user
friendSchema.statics.getFriends = async function(userId, options = {}) {
  const { includeBlocked = false, page = 1, limit = 20, search = '' } = options;
  
  const query = { userId };
  if (!includeBlocked) {
    query.isBlocked = false;
  }
  
  const friends = await this.find(query)
    .populate('friendId', 'username displayName avatarUrl status lastSeen bio')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  
  // Filter by search if provided
  let filteredFriends = friends;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredFriends = friends.filter(f => 
      f.friendId.username.toLowerCase().includes(searchLower) ||
      f.friendId.displayName.toLowerCase().includes(searchLower)
    );
  }
  
  const total = await this.countDocuments(query);
  
  return {
    friends: filteredFriends,
    total,
    page,
    limit
  };
};

// Static method to check if two users are friends
friendSchema.statics.areFriends = async function(userId1, userId2) {
  const friendship = await this.findOne({
    userId: userId1,
    friendId: userId2,
    isBlocked: false
  });
  
  return !!friendship;
};

// Static method to remove friendship (both directions)
friendSchema.statics.removeFriendship = async function(userId1, userId2) {
  await this.deleteMany({
    $or: [
      { userId: userId1, friendId: userId2 },
      { userId: userId2, friendId: userId1 }
    ]
  });
};

const Friend = mongoose.model('Friend', friendSchema);

export default Friend;
