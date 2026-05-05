import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  hashedPassword: {
    type: String,
    required: [true, 'Password is required'],
    select: false // IMPORTANT: Don't return password by default
  },
  avatarUrl: {
    type: String,
    default: null // Link CDN avatar (Cloudinary/S3)
  },
  avatarId: {
    type: String,
    default: null // Cloudinary public_id for deletion
  },
  bio: {
    type: String,
    default: null,
    maxlength: [200, 'Bio cannot exceed 200 characters']
  },
  phone: {
    type: String,
    default: null,
    sparse: true, // Allow multiple docs with null phone, but no unique constraint
    match: [/^\+?[0-9]{10,15}$/, 'Please provide a valid phone number']
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ displayName: 'text' }); // Text search for finding users

// Virtual for checking if user is currently online
userSchema.virtual('isOnline').get(function() {
  return this.status === 'online';
});

// Method to compare password during login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.hashedPassword);
};

// Method to get public profile (safe to send to frontend)
userSchema.methods.toPublicProfile = function() {
  return {
    _id: this._id,
    username: this.username,
    displayName: this.displayName,
    email: this.email,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    phone: this.phone,
    status: this.status,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt
  };
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.hashedPassword;
  delete obj.avatarId;
  delete obj.__v;
  return obj;
};

// Hash password before saving (if password is modified)
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('hashedPassword')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.hashedPassword = await bcrypt.hash(this.hashedPassword, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

export default User;
