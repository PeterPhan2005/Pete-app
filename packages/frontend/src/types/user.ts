export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  status?: 'online' | 'offline';
  lastSeen?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Friend {
  _id: string;
  userId: string;
  friendId: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    status?: 'online' | 'offline';
    lastSeen?: string;
    bio?: string;
  };
  isBlocked: boolean;
  createdAt: string;
}

export interface FriendRequest {
  _id: string;
  from?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  to?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  message: string;
  createdAt: string;
  updatedAt: string;
}
