import { X, Pin } from "lucide-react";
import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/chat";

interface PinnedMessagesBarProps {
  conversationId: string;
}

const PinnedMessagesBar = ({ conversationId }: PinnedMessagesBarProps) => {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { getPinnedMessages, unpinMessage, conversations } = useChatStore();
  const { socket } = useSocketStore();
  const { user } = useAuthStore();

  // Get current conversation's pinned messages from store
  const currentConvo = conversations.find(c => c._id === conversationId);
  const pinnedMessageIds = currentConvo?.pinnedMessages || [];

  // Only admins and group creator can unpin messages in group conversations
  const canUnpin = (() => {
    if (!currentConvo || currentConvo.type !== "group") return true;
    if (!user) return false;
    const userId = user._id?.toString();
    const isAdmin = currentConvo.admins?.some(
      (a: any) => (a._id ?? a)?.toString() === userId
    );
    const isCreator =
      (currentConvo.createdBy?._id ?? currentConvo.createdBy)?.toString() === userId;
    return isAdmin || isCreator;
  })();

  useEffect(() => {
    const loadPinnedMessages = async () => {
      try {
        const messages = await getPinnedMessages(conversationId);
        setPinnedMessages(messages || []);
      } catch (error) {
        console.error("Error loading pinned messages:", error);
      }
    };

    loadPinnedMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, pinnedMessageIds.length]);

  // Listen to socket events for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleMessagePinned = ({ conversationId: convoId }: any) => {
      if (convoId === conversationId) {
        // Reload pinned messages
        getPinnedMessages(conversationId).then(messages => {
          setPinnedMessages(messages || []);
        });
      }
    };

    const handleMessageUnpinned = ({ conversationId: convoId }: any) => {
      if (convoId === conversationId) {
        // Reload pinned messages
        getPinnedMessages(conversationId).then(messages => {
          setPinnedMessages(messages || []);
        });
      }
    };

    socket.on('message-pinned', handleMessagePinned);
    socket.on('message-unpinned', handleMessageUnpinned);

    return () => {
      socket.off('message-pinned', handleMessagePinned);
      socket.off('message-unpinned', handleMessageUnpinned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId]);

  const handleUnpin = async (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unpinMessage(conversationId, messageId);
      setPinnedMessages(prev => prev.filter(m => m._id !== messageId));
    } catch (error) {
      console.error("Error unpinning message:", error);
    }
  };

  if (pinnedMessages.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-blue-50 dark:bg-blue-950/20">
      <div 
        className={cn(
          "transition-all duration-200",
          isExpanded ? "max-h-[200px] overflow-y-auto" : "max-h-[60px] overflow-hidden"
        )}
      >
        {pinnedMessages.map((message, index) => {
          const senderName = message.senderId?.displayName || message.sender?.displayName || 'Unknown';
          
          return (
            <div
              key={message._id}
              className="flex items-start gap-2 p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer group"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Pin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {senderName}
                </p>
                <p className={cn(
                  "text-sm text-gray-700 dark:text-gray-300",
                  !isExpanded && "line-clamp-1"
                )}>
                  {message.content}
                </p>
              </div>
              {canUnpin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => handleUnpin(message._id, e)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {pinnedMessages.length > 1 && (
        <div className="text-center py-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-blue-600 dark:text-blue-400"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Thu gọn" : `Xem ${pinnedMessages.length} tin nhắn đã ghim`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PinnedMessagesBar;
