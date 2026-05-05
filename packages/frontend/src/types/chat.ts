export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  joinedAt: string;
  leftAt?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  role?: "admin" | "member";
  notificationSettings?: NotificationSettings;
  lastSeen?: string | null;
  status?: "online" | "offline";
}

export interface NotificationSettings {
  enabled: boolean;
  mentions: boolean;
  replies: boolean;
  isMuted: boolean;
  mutedUntil: Date | null;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
  description?: string;
  avatar?: string;
}

export interface GroupSettings {
  onlyAdminsCanSend: boolean;
  onlyAdminsCanEditGroup: boolean;
  allowMembersToInvite: boolean;
}

export interface Reaction {
  emoji: string;
  users: Array<{
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  }>;
  count: number;
}

export interface MediaAttachment {
  type: "image" | "video" | "file";
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  thumbnailUrl?: string;
}

export interface LastMessage {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  type?: "text" | "image" | "video" | "file";
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  user?: Participant; // For direct conversations - the other user
  group?: Group;
  settings?: GroupSettings;
  participants: Participant[];
  admins?: string[]; // Array of user IDs
  createdBy?: string;
  pinnedMessages?: string[]; // Array of message IDs
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = unread count
  isPinned?: boolean;
  isMuted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  sender?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
    username?: string;
  };
  content: string | null;
  type: "text" | "image" | "video" | "file" | "call";
  imgUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  media?: MediaAttachment;
  callMetadata?: {
    callId: string;
    callType: "audio" | "video";
    duration: number;
    endReason?: string;
    caller: {
      _id: string;
      displayName: string;
      avatarUrl?: string;
    };
  };
  reactions?: Reaction[];
  replyTo?: {
    _id: string;
    content: string;
    type?: "text" | "image" | "video" | "file";
    sender?: {
      _id: string;
      displayName: string;
      avatarUrl?: string | null;
    };
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[]; // Array of user IDs who deleted this message
  forwardedFrom?: {
    messageId: string;
    conversationId: string;
  };
  readBy?: Array<{
    userId: string;
    readAt: Date;
  }>;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
}

export interface PinnedMessage extends Message {
  pinnedAt: string;
  pinnedBy: string;
}

export interface ConversationDetails extends Conversation {
  participantDetails: Array<{
    user: {
      _id: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
      status?: "online" | "offline" | "away";
    };
    joinedAt: string;
    leftAt?: string | null;
    isPinned: boolean;
    role: "admin" | "member";
  }>;
}

export interface ConversationListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MessageSearchResult {
  message: Message;
  matchedContent: string;
  conversationName?: string;
}
