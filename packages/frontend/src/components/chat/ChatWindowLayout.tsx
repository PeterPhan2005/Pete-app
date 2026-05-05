import { useChatStore } from "@/stores/useChatStore";
import ChatWelcomeScreen from "./ChatWelcomeScreen";
import { SidebarInset } from "../ui/sidebar";
import ChatWindowHeader from "./ChatWindowHeader";
import ChatWindowBody from "./ChatWindowBody";
import MessageInput from "./MessageInput";
import BlockedUserMessage from "./BlockedUserMessage";
import PinnedMessagesBar from "./PinnedMessagesBar";
import { useEffect, useState, useMemo } from "react";
import ChatWindowSkeleton from "../skeleton/ChatWindowSkeleton";
import { useAuthStore } from "@/stores/useAuthStore";
import { friendService } from "@/services/friendService";
import type { Message } from "@/types/chat";
import { useSocketStore } from "@/stores/useSocketStore";

const ChatWindowLayout = () => {
  const {
    activeConversationId,
    conversations,
    messageLoading: loading,
    markAsSeen,
    typingUsers,
    setActiveConversation,
  } = useChatStore();
  
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const [blockStatus, setBlockStatus] = useState<{
    isBlocked: boolean;
    blockedBy: string | null;
    otherUser: any;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const selectedConvo = useMemo(
    () => conversations?.find((c) => c._id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  // Auto-close conversation if it no longer exists (user was removed from group)
  useEffect(() => {
    if (activeConversationId && !selectedConvo && conversations) {
      // Conversation was removed, close it
      setActiveConversation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, conversations?.length, selectedConvo]); // selectedConvo changes when conversation is removed

  // Check block status for direct conversations
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!selectedConvo || selectedConvo.type !== 'direct' || !user) {
        setBlockStatus(null);
        return;
      }

      // Find the other user in conversation
      const otherParticipant = selectedConvo.participants?.find((p: any) => {
        const pId = typeof p === 'string' ? p : p._id;
        return pId?.toString() !== user._id;
      });

      if (!otherParticipant) {
        setBlockStatus(null);
        return;
      }

      const otherUserId = typeof otherParticipant === 'string' 
        ? otherParticipant 
        : otherParticipant._id;
      
      if (!otherUserId) {
        setBlockStatus(null);
        return;
      }

      const otherUserData = typeof otherParticipant === 'object'
        ? otherParticipant
        : null;

      try {
        const response = await friendService.getFriendshipStatus(otherUserId);
        const status = response.data;
        
        if (status.status === 'blocked') {
          setBlockStatus({
            isBlocked: true,
            blockedBy: status.blockedBy,
            otherUser: otherUserData
          });
        } else {
          setBlockStatus(null);
        }
      } catch (error) {
        console.error("Error checking block status:", error);
        setBlockStatus(null);
      }
    };

    checkBlockStatus();
  }, [selectedConvo?._id, selectedConvo?.type, user?._id]);

  // Listen for block/unblock events
  useEffect(() => {
    if (!socket || !selectedConvo || selectedConvo.type !== 'direct') return;

    const handleUserBlocked = ({ userId }: { userId: string; blockedBy: string }) => {
      // Refresh block status when someone blocks/gets blocked
      const otherParticipant = selectedConvo.participants?.find((p: any) => {
        const pId = typeof p === 'string' ? p : p._id;
        return pId?.toString() !== user?._id;
      });

      if (!otherParticipant) return;

      const otherUserId = typeof otherParticipant === 'string' 
        ? otherParticipant 
        : otherParticipant?._id;

      if (!otherUserId) return;

      // If the event involves the other user in this conversation, refresh
      if (userId === otherUserId || userId === user?._id) {
        // Re-check block status
        setTimeout(async () => {
          try {
            const response = await friendService.getFriendshipStatus(otherUserId);
            const status = response.data;
            
            if (status.status === 'blocked') {
              const otherUserData = typeof otherParticipant === 'object'
                ? otherParticipant
                : null;
              
              setBlockStatus({
                isBlocked: true,
                blockedBy: status.blockedBy,
                otherUser: otherUserData
              });
            } else {
              setBlockStatus(null);
            }
          } catch (error) {
            console.error("Error refreshing block status:", error);
          }
        }, 100);
      }
    };

    const handleUserUnblocked = ({ userId }: { userId: string }) => {
      // Refresh block status when someone unblocks
      const otherParticipant = selectedConvo.participants?.find((p: any) => {
        const pId = typeof p === 'string' ? p : p._id;
        return pId?.toString() !== user?._id;
      });

      if (!otherParticipant) return;

      const otherUserId = typeof otherParticipant === 'string' 
        ? otherParticipant 
        : otherParticipant?._id;

      if (!otherUserId) return;

      // If the event involves the other user in this conversation, clear block status
      if (userId === otherUserId || userId === user?._id) {
        setBlockStatus(null);
      }
    };

    socket.on('user-blocked', handleUserBlocked);
    socket.on('user-unblocked', handleUserUnblocked);

    return () => {
      socket.off('user-blocked', handleUserBlocked);
      socket.off('user-unblocked', handleUserUnblocked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, selectedConvo?._id, selectedConvo?.type, user?._id]);

  useEffect(() => {
    if (!selectedConvo) {
      return;
    }

    const markSeen = async () => {
      try {
        await markAsSeen();
      } catch (error) {
        console.error("Lỗi khi markSeen", error);
      }
    };

    markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvo?._id]);

  // Reset reply when conversation changes
  useEffect(() => {
    setReplyingTo(null);
  }, [activeConversationId]);

  // Get typing users for current conversation - MUST be before any return
  const currentTypingUsers = useMemo(() => {
    if (!selectedConvo) return [];
    return typingUsers[selectedConvo._id] || [];
  }, [typingUsers, selectedConvo]);

  // Format typing indicator text - MUST be before any return
  const typingText = useMemo(() => {
    if (currentTypingUsers.length === 0) return null;
    
    if (selectedConvo?.type === "direct") {
      // For direct chat, show user name
      return `${currentTypingUsers[0].userName} đang soạn tin...`;
    } else {
      // For group chat, just show "Someone is typing..."
      return "Ai đó đang soạn tin...";
    }
  }, [currentTypingUsers, selectedConvo?.type]);

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleUnblock = () => {
    // Refresh block status after unblock
    setBlockStatus(null);
  };

  // Early returns AFTER all Hooks
  if (!selectedConvo) {
    return <ChatWelcomeScreen />;
  }

  if (loading) {
    return <ChatWindowSkeleton />;
  }

  // Check if blocked
  const isBlocked = blockStatus?.isBlocked;
  const isBlockedByMe = blockStatus?.blockedBy === user?._id;
  const otherUserName = blockStatus?.otherUser?.displayName || 'người dùng này';
  const otherUserId = blockStatus?.otherUser?._id;

  return (
    <SidebarInset className="flex flex-col h-full flex-1 overflow-hidden rounded-sm shadow-md">
      {/* Header */}
      <ChatWindowHeader chat={selectedConvo} />

      {/* Pinned Messages Bar */}
      {!isBlocked && <PinnedMessagesBar conversationId={selectedConvo._id} />}

      {/* Body - Always show messages */}
      <div className="flex-1 overflow-y-auto bg-primary-foreground">
        <ChatWindowBody onReply={handleReply} />
      </div>

      {/* Footer */}
      {isBlocked ? (
        <BlockedUserMessage 
          message={isBlockedByMe 
            ? `Bỏ chặn để gửi tin nhắn tới ${otherUserName}` 
            : `${otherUserName} đã chặn bạn`
          }
          isBlockedByMe={isBlockedByMe}
          otherUserId={otherUserId}
          onUnblock={handleUnblock}
        />
      ) : (
        <>
          {/* Typing Indicator */}
          {typingText && (
            <div className="px-4 py-2 bg-background border-t">
              <p className="text-xs text-muted-foreground italic">
                {typingText}
              </p>
            </div>
          )}
          
          <MessageInput 
            selectedConvo={selectedConvo} 
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
          />
        </>
      )}
    </SidebarInset>
  );
};

export default ChatWindowLayout;
