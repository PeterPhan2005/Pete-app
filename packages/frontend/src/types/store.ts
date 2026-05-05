import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";
import type { Friend, FriendRequest, User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  signUp: (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchMe: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null; // phân trang
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  typingUsers: Record<string, { userId: string; userName: string }[]>; // conversationId -> array of typing users
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  setTypingUsers: (conversationId: string, users: { userId: string; userName: string }[]) => void;
  addTypingUser: (conversationId: string, userId: string, userName: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    imgUrl?: string,
    conversationId?: string,
    replyTo?: string
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    imgUrl?: string,
    replyTo?: string
  ) => Promise<void>;
  sendMessageWithFile: (
    conversationId: string,
    content: string,
    file: File,
    replyTo?: string
  ) => Promise<void>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  // update convo
  updateConversation: (conversation: unknown) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<string>;

  // Message Actions
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  forwardMessage: (messageId: string, conversationIds: string[]) => Promise<void>;
  searchMessages: (conversationId: string, query: string) => Promise<Message[]>;
  getPinnedMessages: (conversationId: string) => Promise<Message[]>;
  getMediaMessages: (conversationId: string) => Promise<any[]>;

  // Conversation Management
  createDirectConversation: (userId: string) => Promise<Conversation>;
  createGroupConversation: (
    groupName: string,
    participantIds: string[],
    description?: string,
    avatar?: string
  ) => Promise<Conversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  togglePinConversation: (conversationId: string) => Promise<void>;
  addParticipant: (conversationId: string, userId: string) => Promise<void>;
  removeParticipant: (conversationId: string, userId: string) => Promise<void>;
  updateGroupInfo: (
    conversationId: string,
    data: {
      groupName?: string;
      groupDescription?: string;
      groupAvatar?: string;
    }
  ) => Promise<void>;
  updateGroupSettings: (
    conversationId: string,
    settings: {
      onlyAdminsCanSend?: boolean;
      onlyAdminsCanEditGroup?: boolean;
      allowMembersToInvite?: boolean;
    }
  ) => Promise<void>;
  pinMessage: (conversationId: string, messageId: string) => Promise<void>;
  unpinMessage: (conversationId: string, messageId: string) => Promise<void>;
  addParticipantToGroup: (conversationId: string, userId: string) => Promise<void>;
  removeParticipantFromGroup: (conversationId: string, userId: string) => Promise<void>;
  addAdminToGroup: (conversationId: string, userId: string) => Promise<void>;
  removeAdminFromGroup: (conversationId: string, userId: string) => Promise<void>;
  updateNotificationSettings: (
    conversationId: string,
    settings: {
      enabled?: boolean;
      mentions?: boolean;
      replies?: boolean;
      muteUntil?: string | null | "forever";
    }
  ) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  searchByUsername: (username: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  // Socket event handlers
  addReceivedRequest: (request: FriendRequest) => void;
  removeSentRequest: (requestId: string) => void;
}

export interface UserState {
  updateAvatarUrl: (formData: FormData) => Promise<void>;
}
