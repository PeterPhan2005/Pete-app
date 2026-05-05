import { useFriendStore } from "@/stores/useFriendStore";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { MessageCircleMore, Users } from "lucide-react";
import { Card } from "../ui/card";
import UserAvatar from "../chat/UserAvatar";
import { useChatStore } from "@/stores/useChatStore";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface FriendListModalProps {
  onClose?: () => void;
}

const FriendListModal = ({ onClose }: FriendListModalProps) => {
  const { friends } = useFriendStore();
  const { conversations, setActiveConversation, createDirectConversation } = useChatStore();
  const navigate = useNavigate();
  const [creatingConvoWith, setCreatingConvoWith] = useState<string | null>(null);

  const handleAddConversation = async (friendId: string) => {
    // Prevent duplicate clicks
    if (creatingConvoWith) return;
    
    setCreatingConvoWith(friendId);
    try {
      // Check if conversation with this friend already exists
      const existingConvo = conversations.find(convo => {
        if (convo.type !== 'direct') return false;
        
        // Check if this friend is in the conversation
        return convo.participants?.some((p: any) => {
          const participantId = typeof p === 'string' ? p : (p._id || p.userId?._id);
          return participantId?.toString() === friendId.toString();
        });
      });

      if (existingConvo) {
        // If conversation exists, just navigate to it
        setActiveConversation(existingConvo._id);
        onClose?.();
        navigate(`/?conversationId=${existingConvo._id}`);
        return;
      }

      // Create new conversation if doesn't exist
      const conversation = await createDirectConversation(friendId);
      
      // Close dialog
      onClose?.();
      
      // Navigate to the conversation
      if (conversation?._id) {
        navigate(`/?conversationId=${conversation._id}`);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setCreatingConvoWith(null);
    }
  };

  return (
    <DialogContent className="glass max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl capitalize">
          <MessageCircleMore className="size-5" />
          bắt đầu hội thoại mới
        </DialogTitle>
        <DialogDescription>
          Chọn bạn bè để bắt đầu trò chuyện hoặc tạo nhóm mới
        </DialogDescription>
      </DialogHeader>

      {/* friends list */}
      <div className="space-y-4">
        <h1 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          danh sách bạn bè
        </h1>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {friends.map((friend) => {
            // Extract friend data - handle both populated and non-populated friendId
            const friendData = friend.friendId || friend;
            const friendId = friendData._id || friend._id;
            const displayName = friendData.displayName || friend.displayName;
            const username = friendData.username || friend.username;
            const avatarUrl = friendData.avatarUrl || friend.avatarUrl;
            
            return (
              <Card
                onClick={() => handleAddConversation(friendId)}
                key={friendId}
                className="p-3 cursor-pointer transition-smooth hover:shadow-soft glass hover:bg-muted/30 group/friendCard relative"
              >
                {creatingConvoWith === friendId && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {/* avatar */}
                  <div className="relative">
                    <UserAvatar
                      type="sidebar"
                      name={displayName}
                      avatarUrl={avatarUrl}
                    />
                  </div>

                  {/* info */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h2 className="font-semibold text-sm truncate">
                      {displayName}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      @{username}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}

          {friends.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-12 mx-auto mb-3 opacity-50" />
              Chưa có bạn bè. Thêm bạn vô để tám!
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
};

export default FriendListModal;
