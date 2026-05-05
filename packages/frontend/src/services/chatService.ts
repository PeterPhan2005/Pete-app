import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

interface SearchMessagesResponse {
  success: boolean;
  data: Message[];
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

interface MediaMessagesResponse {
  success: boolean;
  data: Array<{
    type: "image" | "video" | "file";
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileMimeType: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
}

const pageLimit = 50;

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversation");
    return res.data;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get(
      `/conversation/${id}/messages?limit=${pageLimit}&cursor=${cursor}`
    );

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

  async sendDirectMessage(
    recipientId: string,
    content: string = "",
    imgUrl?: string,
    conversationId?: string,
    replyTo?: string
  ) {
    // If conversationId is provided, use it directly
    if (conversationId) {
      const res = await api.post("/message/send", {
        conversationId,
        content,
        type: imgUrl ? "image" : "text",
        fileUrl: imgUrl,
        replyTo,
      });
      return res.data.data;
    }

    // Otherwise, create/find conversation first
    const convoRes = await api.post("/conversation/direct", { userId: recipientId });
    const newConversationId = convoRes.data.data.conversation._id;

    const res = await api.post("/message/send", {
      conversationId: newConversationId,
      content,
      type: imgUrl ? "image" : "text",
      fileUrl: imgUrl,
      replyTo,
    });

    return res.data.data;
  },

  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
    replyTo?: string
  ) {
    const res = await api.post("/message/send", {
      conversationId,
      content,
      type: imgUrl ? "image" : "text",
      fileUrl: imgUrl,
      replyTo,
    });
    return res.data.data;
  },

  async sendMessageWithFile(
    conversationId: string,
    content: string = "",
    file: File,
    replyTo?: string
  ) {
    // Upload file to Cloudinary first
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await api.post('/message/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const fileUrl = uploadRes.data.data.url;
    const fileType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 'file';

    // Send message with file URL
    const res = await api.post("/message/send", {
      conversationId,
      content,
      type: fileType,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      fileMimeType: file.type,
      replyTo,
    });

    return res.data.data;
  },

  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversation/${conversationId}/seen`);
    return res.data;
  },

  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[]
  ) {
    if (type === "direct") {
      // For direct conversation, only need userId
      const res = await api.post("/conversation/direct", { userId: memberIds[0] });
      return res.data.data.conversation;
    } else {
      // For group conversation
      const res = await api.post("/conversation/group", {
        groupName: name,
        participantIds: memberIds,
      });
      return res.data.data.conversation;
    }
  },

  /**
   * Edit an existing message
   */
  async editMessage(messageId: string, content: string) {
    const res = await api.put(`/message/${messageId}`, { content });
    return res.data.data;
  },

  /**
   * Delete a message for me only
   */
  async deleteMessage(messageId: string) {
    const res = await api.delete(`/message/${messageId}/for-me`);
    return res.data;
  },

  /**
   * Delete a message for everyone
   */
  async deleteMessageForEveryone(messageId: string) {
    const res = await api.delete(`/message/${messageId}/for-everyone`);
    return res.data;
  },

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, emoji: string) {
    const res = await api.post(`/message/${messageId}/react`, { emoji });
    return res.data.data;
  },

  /**
   * Remove reaction from a message
   */
  async removeReaction(messageId: string, emoji: string) {
    const res = await api.delete(`/message/${messageId}/react?emoji=${encodeURIComponent(emoji)}`);
    return res.data;
  },

  /**
   * Forward a message to other conversations
   */
  async forwardMessage(messageId: string, conversationIds: string[]) {
    const res = await api.post(`/message/${messageId}/forward`, {
      conversationIds,
    });
    return res.data;
  },

  /**
   * Search messages in a conversation
   */
  async searchMessages(
    conversationId: string,
    query: string,
    limit: number = 20
  ): Promise<SearchMessagesResponse> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });

    const res = await api.get(`/message/${conversationId}/search?${params.toString()}`);
    return res.data;
  },

  /**
   * Get pinned messages in a conversation
   */
  async getPinnedMessages(conversationId: string) {
    const res = await api.get(`/message/${conversationId}/pinned`);
    return res.data.data;
  },

  /**
   * Get media messages (images, videos, files) in a conversation
   */
  async getMediaMessages(
    conversationId: string,
    limit: number = 20,
    skip: number = 0
  ): Promise<MediaMessagesResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
    });

    const res = await api.get(
      `/message/${conversationId}/media?${params.toString()}`
    );
    return res.data;
  },

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string) {
    const res = await api.put(`/message/${messageId}/read`);
    return res.data;
  },
};
