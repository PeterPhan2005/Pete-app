import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    type: String,
    maxlength: [200, 'Message cannot exceed 200 characters'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
    index: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
friendRequestSchema.index({ to: 1, status: 1 });
friendRequestSchema.index({ from: 1, status: 1 });

// TTL index to auto-delete expired pending requests
friendRequestSchema.index({ expiresAt: 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: { status: 'pending' }
});

// Virtual to check if expired
friendRequestSchema.virtual('isExpired').get(function() {
  return this.status === 'pending' && this.expiresAt < new Date();
});

// Method to accept friend request
friendRequestSchema.methods.accept = async function() {
  this.status = 'accepted';
  await this.save();
  
  // Create Friend records (bidirectional)
  const Friend = mongoose.model('Friend');
  await Friend.create([
    { userId: this.from, friendId: this.to },
    { userId: this.to, friendId: this.from }
  ]);
  
  return this;
};

// Method to reject friend request
friendRequestSchema.methods.reject = async function() {
  this.status = 'rejected';
  await this.save();
  return this;
};

// Static method to check if request exists
friendRequestSchema.statics.exists = async function(from, to) {
  return await this.findOne({
    $or: [
      { from, to },
      { from: to, to: from }
    ],
    status: 'pending'
  });
};

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

export default FriendRequest;
