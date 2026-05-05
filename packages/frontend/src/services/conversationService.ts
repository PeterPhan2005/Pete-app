import api from "@/lib/axios";

interface ConversationListResponse {
  success: boolean;
  data: {
    conversations: any[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ConversationDetailsResponse {
  success: boolean;
  data: any;
}

interface NotificationSettings {
  enabled?: boolean;
  mentions?: boolean;
  replies?: boolean;
  muteUntil?: string | null | "forever";
}

interface GroupSettings {
  onlyAdminsCanSend?: boolean;
  onlyAdminsCanEditGroup?: boolean;
  allowMembersToInvite?: boolean;
}

export const conversationService = {
  /**
   * Create a direct conversation with another user
   */
  async createDirectConversation(userId: string) {
    const res = await api.post("/conversation/direct", { userId });
    return res.data.data;
  },

  /**
   * Create a group conversation
   */
  async createGroupConversation(
    groupName: string,
    participantIds: string[],
    description?: string,
    avatar?: string
  ) {
    const res = await api.post("/conversation/group", {
      groupName,
      participantIds,
      description,
      avatar,
    });
    return res.data.data;
  },

  /**
   * Get list of conversations with pagination and search
   */
  async getConversations(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<ConversationListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append("search", search);
    }

    const res = await api.get(`/conversation?${params.toString()}`);
    return res.data;
  },

  /**
   * Get conversation details with participants
   */
  async getConversationDetails(
    conversationId: string
  ): Promise<ConversationDetailsResponse> {
    const res = await api.get(`/conversation/${conversationId}`);
    return res.data;
  },

  /**
   * Delete a conversation (soft delete - hide for current user only)
   */
  async deleteConversation(conversationId: string) {
    const res = await api.delete(`/conversation/${conversationId}`);
    return res.data;
  },

  /**
   * Disband a group (hard delete - delete for everyone, creator only)
   */
  async disbandGroup(conversationId: string) {
    const res = await api.delete(`/conversation/${conversationId}/disband`);
    return res.data;
  },

  /**
   * Leave a group conversation
   */
  async leaveConversation(conversationId: string) {
    const res = await api.post(`/conversation/${conversationId}/leave`);
    return res.data;
  },

  /**
   * Toggle pin conversation (user-specific)
   */
  async togglePinConversation(conversationId: string) {
    const res = await api.put(`/conversation/${conversationId}/pin`);
    return res.data;
  },

  /**
   * Add a participant to group conversation
   */
  async addParticipant(conversationId: string, userId: string) {
    const res = await api.post(`/conversation/${conversationId}/participant`, {
      userId,
    });
    return res.data;
  },

  /**
   * Remove a participant from group conversation
   */
  async removeParticipant(conversationId: string, userId: string) {
    const res = await api.delete(
      `/conversation/${conversationId}/participant/${userId}`
    );
    return res.data;
  },

  /**
   * Add admin to group conversation
   */
  async addAdmin(conversationId: string, userId: string) {
    const res = await api.post(`/conversation/${conversationId}/admin`, {
      userId,
    });
    return res.data;
  },

  /**
   * Remove admin from group conversation
   */
  async removeAdmin(conversationId: string, userId: string) {
    const res = await api.delete(
      `/conversation/${conversationId}/admin/${userId}`
    );
    return res.data;
  },

  /**
   * Update group info (name, description, avatar)
   */
  async updateGroupInfo(
    conversationId: string,
    data: {
      groupName?: string;
      groupDescription?: string;
      groupAvatar?: string;
    }
  ) {
    const res = await api.put(`/conversation/${conversationId}/info`, data);
    return res.data;
  },

  /**
   * Update group settings (permissions)
   */
  async updateGroupSettings(
    conversationId: string,
    settings: GroupSettings
  ) {
    const res = await api.put(
      `/conversation/${conversationId}/settings`,
      settings
    );
    return res.data;
  },

  /**
   * Pin a message in conversation
   */
  async pinMessage(conversationId: string, messageId: string) {
    const res = await api.post(
      `/conversation/${conversationId}/pin/${messageId}`
    );
    return res.data;
  },

  /**
   * Unpin a message from conversation
   */
  async unpinMessage(conversationId: string, messageId: string) {
    const res = await api.delete(
      `/conversation/${conversationId}/pin/${messageId}`
    );
    return res.data;
  },

  /**
   * Update notification settings for conversation
   */
  async updateNotificationSettings(
    conversationId: string,
    settings: NotificationSettings
  ) {
    const res = await api.put(
      `/conversation/${conversationId}/notification`,
      settings
    );
    return res.data;
  },

  /**
   * Clean up duplicate conversations
   */
  async cleanupDuplicates() {
    const res = await api.post("/conversation/cleanup-duplicates");
    return res.data;
  },

  /**
   * Search for groups by name
   */
  async searchGroups(query: string) {
    const res = await api.get(`/conversation/search-groups?query=${encodeURIComponent(query)}`);
    return res.data;
  },

  /**
   * Rejoin a group after leaving
   */
  async rejoinGroup(conversationId: string) {
    const res = await api.post(`/conversation/${conversationId}/rejoin`);
    return res.data;
  },

  /**
   * Search conversations (including deleted ones)
   */
  async searchConversations(query: string) {
    const res = await api.get(`/conversation/search?query=${encodeURIComponent(query)}`);
    return res.data;
  },

  /**
   * Restore a deleted conversation
   */
  async restoreConversation(conversationId: string) {
    const res = await api.post(`/conversation/${conversationId}/restore`);
    return res.data;
  },
};
