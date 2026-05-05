import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";

export const useUserStore = create<UserState>(() => ({
  updateAvatarUrl: async (formData) => {
    try {
      const { user, setUser } = useAuthStore.getState();
      const response = await userService.uploadAvatar(formData);

      if (user && response.data) {
        const newAvatarUrl = response.data.avatarUrl;
        
        // Update user in auth store
        setUser({
          ...user,
          avatarUrl: newAvatarUrl,
        });

        // Update avatar in all conversations using zustand set
        useChatStore.setState((state) => ({
          conversations: state.conversations.map(convo => {
            // Update participants
            const updatedParticipants = convo.participants?.map((p: any) => {
              const participantId = typeof p === 'string' ? p : (p._id || p.userId?._id);
              if (participantId === user._id) {
                // Update this participant's avatar
                if (typeof p === 'object' && p.userId) {
                  return {
                    ...p,
                    userId: {
                      ...p.userId,
                      avatarUrl: newAvatarUrl
                    }
                  };
                } else if (typeof p === 'object') {
                  return {
                    ...p,
                    avatarUrl: newAvatarUrl
                  };
                }
              }
              return p;
            });

            // Update user field for direct conversations
            if (convo.type === 'direct' && convo.user) {
              const userId = typeof convo.user === 'string' ? convo.user : convo.user._id;
              if (userId === user._id) {
                return {
                  ...convo,
                  user: typeof convo.user === 'object' ? {
                    ...convo.user,
                    avatarUrl: newAvatarUrl
                  } : convo.user,
                  participants: updatedParticipants
                };
              }
            }

            return {
              ...convo,
              participants: updatedParticipants
            };
          })
        }));
        
        toast.success("Đã cập nhật avatar thành công!");
      }
    } catch (error) {
      console.error("Lỗi khi updateAvatarUrl", error);
      toast.error("Upload avatar không thành công!");
    }
  },
}));
