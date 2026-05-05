import api from "@/lib/axios";

export const friendService = {
  async searchByUsername(username: string) {
    const res = await api.get(`/user/search?username=${username}`);
    return res.data.data; // Return array of users
  },

  async sendFriendRequest(to: string, message?: string) {
    const res = await api.post("/friend/add", { userId: to, message });
    return res.data.message;
  },

  async getAllFriendRequest() {
    try {
      const res = await api.get("/friend/requests/all");
      const { sent, received } = res.data;
      return { sent, received };
    } catch (error) {
      console.error("Lỗi khi gửi getAllFriendRequest", error);
    }
  },

  async acceptRequest(requestId: string) {
    try {
      const res = await api.post(`/friend/accept/${requestId}`);
      return res.data.requestAcceptedBy;
    } catch (error) {
      console.error("Lỗi khi gửi acceptRequest", error);
    }
  },

  async declineRequest(requestId: string) {
    try {
      await api.post(`/friend/decline/${requestId}`);
    } catch (error) {
      console.error("Lỗi khi gửi declineRequest", error);
    }
  },

  async cancelRequest(requestId: string) {
    const res = await api.delete(`/friend/cancel/${requestId}`);
    return res.data;
  },

  async getFriendList() {
    const res = await api.get("/friend/all");
    return res.data.data;
  },

  async blockFriend(friendId: string) {
    const res = await api.post(`/friend/block/${friendId}`);
    return res.data;
  },

  async unblockFriend(friendId: string) {
    const res = await api.post(`/friend/unblock/${friendId}`);
    return res.data;
  },

  async getBlockedFriends() {
    const res = await api.get("/friend/blocked");
    return res.data;
  },

  async getFriendshipStatus(userId: string) {
    const res = await api.get(`/friend/status/${userId}`);
    return res.data;
  },

  async unfriend(friendId: string) {
    const res = await api.delete(`/friend/unfriend/${friendId}`);
    return res.data;
  },
};
