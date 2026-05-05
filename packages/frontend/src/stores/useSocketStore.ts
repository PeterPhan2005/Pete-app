import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { useCallStore } from "./useCallStore";
import { toast } from "sonner";

const baseURL = import.meta.env.VITE_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhiều socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"], // Allow fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");
    });

    // online users
    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // new message
    socket.on("new-message", ({ message, unreadCounts }) => {
      const chatStore = useChatStore.getState();
      const existingConvo = chatStore.conversations.find(c => c._id === message.conversationId);

      if (!existingConvo) {
        // Conversation doesn't exist — ignore (could be deleted or not loaded yet)
        console.log("Received message for non-existent conversation:", message.conversationId);
        return;
      }

      // Add message to conversation messages
      chatStore.addMessage(message);

      // Update conversation's lastMessage with the NEW incoming message (NOT existingConvo.lastMessage)
      const updatedConversation = {
        ...existingConvo,
        lastMessage: {
          _id: message._id,
          content: message.content || '',
          senderId: message.senderId,
          sender: {
            _id: message.senderId,
            displayName: message.sender?.displayName || '',
            avatarUrl: message.sender?.avatarUrl || null,
            username: message.sender?.username || '',
          },
          createdAt: message.createdAt,
        },
        lastMessageAt: message.createdAt,
        unreadCounts: unreadCounts || existingConvo.unreadCounts || {},
      };

      // Update conversation in store
      chatStore.updateConversation(updatedConversation);

      // Mark as seen if currently viewing this conversation
      if (chatStore.activeConversationId === message.conversationId) {
        chatStore.markAsSeen();
      }
    });

    // read message
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    // new direct conversation (created by the other party after accepting friend request)
    socket.on("new-conversation", (conversation) => {
      const chatStore = useChatStore.getState();

      // Join the conversation room
      socket.emit("join-conversation", conversation._id);

      // Add conversation to store (addConvo handles duplicates internally)
      chatStore.addConvo(conversation);
    });

    // new group chat
    socket.on("new-group", (conversation) => {
      const chatStore = useChatStore.getState();
      
      // Join the conversation room
      socket.emit("join-conversation", conversation._id);
      
      // Add conversation to store
      chatStore.addConvo(conversation);
      
      // Show notification
      toast.success(`Bạn đã được thêm vào nhóm "${conversation.group?.name || 'Nhóm mới'}"`);
    });

    // friend request received
    socket.on("friend-request-received", ({ request }) => {
      useFriendStore.getState().addReceivedRequest(request);
      
      // Show toast notification
      toast.info(`${request.from.displayName} đã gửi lời mời kết bạn`, {
        duration: 3000,
      });
    });

    // friend request accepted
    socket.on("friend-request-accepted", ({ request }) => {
      useFriendStore.getState().removeSentRequest(request._id);
      useFriendStore.getState().getFriends(); // Reload friends list
      
      // Show toast notification
      toast.success(`${request.to.displayName} đã chấp nhận lời mời kết bạn`, {
        duration: 3000,
      });
    });

    // friend request declined
    socket.on("friend-request-declined", ({ requestId }) => {
      useFriendStore.getState().removeSentRequest(requestId);
      
      // Show toast notification
      toast.info("Lời mời kết bạn đã bị từ chối", {
        duration: 3000,
      });
    });

    // friend added (when you accept someone's request)
    socket.on("friend-added", () => {
      useFriendStore.getState().getFriends(); // Reload friends list
    });

    // friend removed (when someone unfriends you or you unfriend them)
    socket.on("friend-removed", () => {
      useFriendStore.getState().getFriends(); // Reload friends list
    });

    // message pinned
    socket.on("message-pinned", ({ conversationId, pinnedMessages }) => {
      const chatStore = useChatStore.getState();
      chatStore.updateConversation({
        _id: conversationId,
        pinnedMessages
      });
    });

    // message unpinned
    socket.on("message-unpinned", ({ conversationId, pinnedMessages }) => {
      const chatStore = useChatStore.getState();
      chatStore.updateConversation({
        _id: conversationId,
        pinnedMessages
      });
    });

    // message seen
    socket.on("message-seen", ({ conversationId, seenBy, unreadCounts }) => {
      useChatStore.getState().updateConversation({
        _id: conversationId,
        unreadCounts,
        seenBy: [{ _id: seenBy }],
      });
    });

    // message edited
    socket.on("message-edited", ({ messageId, conversationId, content, isEdited, editedAt }) => {
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages[conversationId]?.items || [];
      
      const updatedMessages = messages.map((m) =>
        m._id === messageId
          ? { ...m, content, isEdited, updatedAt: editedAt }
          : m
      );

      chatStore.messages[conversationId] = {
        ...chatStore.messages[conversationId],
        items: updatedMessages,
      };
    });

    // message deleted for everyone
    socket.on("message-deleted-for-everyone", ({ messageId, conversationId }) => {
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages[conversationId]?.items || [];
      
      const updatedMessages = messages.filter((m) => m._id !== messageId);

      chatStore.messages[conversationId] = {
        ...chatStore.messages[conversationId],
        items: updatedMessages,
      };
    });

    // message deleted for me
    socket.on("message-deleted-for-me", ({ messageId, conversationId }) => {
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages[conversationId]?.items || [];
      
      const updatedMessages = messages.filter((m) => m._id !== messageId);

      chatStore.messages[conversationId] = {
        ...chatStore.messages[conversationId],
        items: updatedMessages,
      };
    });

    // message reaction added
    socket.on("message-reaction-added", ({ messageId, conversationId, reactions }) => {
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages[conversationId]?.items || [];
      
      const updatedMessages = messages.map((m) =>
        m._id === messageId ? { ...m, reactions } : m
      );

      chatStore.messages[conversationId] = {
        ...chatStore.messages[conversationId],
        items: updatedMessages,
      };
    });

    // message reaction removed
    socket.on("message-reaction-removed", ({ messageId, conversationId, reactions }) => {
      const chatStore = useChatStore.getState();
      const messages = chatStore.messages[conversationId]?.items || [];
      
      const updatedMessages = messages.map((m) =>
        m._id === messageId ? { ...m, reactions } : m
      );

      chatStore.messages[conversationId] = {
        ...chatStore.messages[conversationId],
        items: updatedMessages,
      };
    });

    // user blocked
    socket.on("user-blocked", ({ userId, message }) => {
      useFriendStore.getState().getFriends(); // Refresh friends list
      
      // Show toast notification
      toast.info(message);
      
      // If currently viewing conversation with blocked user, close it
      const chatStore = useChatStore.getState();
      if (chatStore.activeConversationId) {
        const activeConvo = chatStore.conversations.find(c => c._id === chatStore.activeConversationId);
        if (activeConvo && activeConvo.type === 'direct') {
          const otherUserId = activeConvo.participants?.find((p: any) => {
            const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
            return pId?.toString() === userId?.toString();
          });
          
          if (otherUserId) {
            chatStore.setActiveConversation(null);
          }
        }
      }
    });

    // user unblocked
    socket.on("user-unblocked", () => {
      useFriendStore.getState().getFriends(); // Refresh friends list
    });

    // Group management events
    socket.on("participant-added", () => {
      useChatStore.getState().fetchConversations();
    });

    socket.on("participant-removed", ({ conversationId, userId }) => {
      const chatStore = useChatStore.getState();
      const currentUser = useAuthStore.getState().user;
      
      // If current user was removed, close conversation and remove from list immediately
      if (userId === currentUser?._id) {
        // Close the conversation first
        if (chatStore.activeConversationId === conversationId) {
          chatStore.setActiveConversation(null);
        }
        
        // Then fetch updated conversations
        chatStore.fetchConversations();
        
        toast.info("Bạn đã bị xóa khỏi nhóm");
      } else {
        // Just refresh conversations for other participants
        chatStore.fetchConversations();
      }
    });

    socket.on("admin-added", () => {
      useChatStore.getState().fetchConversations();
    });

    socket.on("admin-removed", () => {
      useChatStore.getState().fetchConversations();
    });

    socket.on("group-info-updated", ({ conversationId, groupName, groupDescription, groupAvatar }) => {
      const chatStore = useChatStore.getState();
      chatStore.updateConversation({
        _id: conversationId,
        group: {
          name: groupName,
          description: groupDescription,
          avatar: groupAvatar
        }
      });
    });

    socket.on("group-settings-updated", ({ conversationId, settings }) => {
      const chatStore = useChatStore.getState();
      chatStore.updateConversation({
        _id: conversationId,
        settings
      });
    });

    socket.on("group-deleted", ({ conversationId }) => {
      const chatStore = useChatStore.getState();
      chatStore.fetchConversations();
      if (chatStore.activeConversationId === conversationId) {
        chatStore.setActiveConversation(null);
      }
      toast.info("Nhóm đã bị giải tán");
    });

    socket.on("user-left-group", () => {
      useChatStore.getState().fetchConversations();
    });

    // User profile updated
    socket.on("user-profile-updated", ({ userId, displayName, avatarUrl, bio }) => {
      const chatStore = useChatStore.getState();
      const friendStore = useFriendStore.getState();
      
      // Update in conversations
      chatStore.conversations.forEach(convo => {
        // Update in participants
        if (convo.participants) {
          convo.participants = convo.participants.map((p: any) => {
            const pId = typeof p === 'string' ? p : p._id;
            if (pId === userId) {
              return typeof p === 'string' ? p : { ...p, displayName, avatarUrl, bio };
            }
            return p;
          });
        }
        
        // Update in direct chat user
        if (convo.type === 'direct' && convo.user && convo.user._id === userId) {
          convo.user = { ...convo.user, displayName, avatarUrl, bio };
        }
      });
      
      // Update in friends list
      friendStore.friends.forEach(friend => {
        const friendData = friend.friendId;
        if (friendData && friendData._id === userId) {
          friendData.displayName = displayName;
          friendData.avatarUrl = avatarUrl;
          friendData.bio = bio;
        }
      });
      
      // Trigger re-render
      chatStore.fetchConversations();
      friendStore.getFriends();
    });

    // Typing indicator
    socket.on("user-typing", ({ userId, userName, isTyping, conversationId }) => {
      const chatStore = useChatStore.getState();
      if (isTyping) {
        chatStore.addTypingUser(conversationId, userId, userName);
      } else {
        chatStore.removeTypingUser(conversationId, userId);
      }
    });

    // ==================== CALL EVENTS ====================
    
    // Incoming call
    socket.on("call:incoming", ({ callId, roomId, conversationId, caller, callType }) => {
      const callStore = useCallStore.getState();
      
      // Set call state to ringing
      callStore.resetCall();
      set({ socket }); // Ensure socket is set
      
      // Update call store with incoming call info
      useCallStore.setState({
        callId,
        roomId,
        conversationId,
        callType,
        callStatus: "ringing",
        caller,
      });
      
      console.log("📞 Incoming call from:", caller.displayName);
    });

    // Call accepted
    socket.on("call:accepted", ({ userId }) => {
      console.log("✅ Call accepted by:", userId);
    });

    // Call declined
    socket.on("call:declined", ({ userId }) => {
      const callStore = useCallStore.getState();
      callStore.resetCall();
      toast.info("Cuộc gọi đã bị từ chối");
      console.log("❌ Call declined by:", userId);
    });

    // Call ended
    socket.on("call:ended", ({ endedBy }) => {
      // Set status to ended instead of resetting immediately
      useCallStore.setState({ callStatus: "ended" });
      toast.info("Cuộc gọi đã kết thúc");
      console.log("📴 Call ended by:", endedBy);
    });

    // Call error
    socket.on("call:error", ({ message }) => {
      const callStore = useCallStore.getState();
      callStore.resetCall();
      toast.error(message || "Lỗi cuộc gọi");
      console.error("❌ Call error:", message);
    });
    
    // ==================== END CALL EVENTS ====================
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
