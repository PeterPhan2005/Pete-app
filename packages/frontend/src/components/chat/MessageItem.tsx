import { cn, formatMessageTime } from "@/lib/utils";
import type { Conversation, Message, Participant } from "@/types/chat";
import UserAvatar from "./UserAvatar";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { MessageContextMenu } from "./MessageContextMenu";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Search } from "lucide-react";
import { CallEndedMessage } from "./CallEndedMessage";
import { useCallStore } from "@/stores/useCallStore";

interface MessageItemProps {
  message: Message;
  index: number;
  messages: Message[];
  selectedConvo: Conversation;
  lastMessageStatus: "delivered" | "seen";
  onReply?: (message: Message) => void;
}

const MessageItem = ({
  message,
  index,
  messages,
  selectedConvo,
  lastMessageStatus,
  onReply,
}: MessageItemProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  
  const { editMessage, forwardMessage, addReaction, conversations, createDirectConversation } = useChatStore();
  const { user } = useAuthStore();

  // Filter conversations based on search query - DON'T exclude current conversation
  const filteredConversations = useMemo(() => {
    // Include all conversations (including current one)
    const convos = conversations;
    
    if (!searchQuery.trim()) return convos;
    
    const query = searchQuery.toLowerCase();
    return convos.filter(convo => {
      if (convo.type === 'group') {
        return convo.group?.name?.toLowerCase().includes(query);
      } else {
        // For direct conversations, search by participant name
        const otherParticipant = convo.participants?.find((p: any) => {
          const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
          return pId?.toString() !== user?._id;
        });
        
        const userData = typeof otherParticipant === 'object' && otherParticipant?.userId
          ? otherParticipant.userId
          : otherParticipant;
        
        const displayName = userData?.displayName || '';
        const username = userData?.username || '';
        
        return displayName.toLowerCase().includes(query) || username.toLowerCase().includes(query);
      }
    });
  }, [conversations, searchQuery, user]);

  // Get conversation display name
  const getConversationName = (convo: Conversation) => {
    if (convo.type === 'group') {
      return convo.group?.name || 'Nhóm';
    } else {
      // For direct conversations, get the other user's name
      const otherParticipant = convo.participants?.find((p: any) => {
        const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
        return pId?.toString() !== user?._id;
      });
      
      // Handle different participant structures
      if (!otherParticipant) return 'Unknown';
      
      if (typeof otherParticipant === 'string') {
        // If it's just an ID, try to get from convo.user
        return convo.user?.displayName || 'Unknown';
      }
      
      const userData = otherParticipant.userId || otherParticipant;
      return userData?.displayName || userData?.username || 'Unknown';
    }
  };

  // Get conversation avatar
  const getConversationAvatar = (convo: Conversation) => {
    if (convo.type === 'group') {
      return convo.group?.avatar;
    } else {
      // Try convo.user first (from backend response)
      if (convo.user?.avatarUrl) {
        return convo.user.avatarUrl;
      }
      
      const otherParticipant = convo.participants?.find((p: any) => {
        const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
        return pId?.toString() !== user?._id;
      });
      
      if (!otherParticipant) return undefined;
      
      if (typeof otherParticipant === 'string') {
        return convo.user?.avatarUrl;
      }
      
      const userData = otherParticipant.userId || otherParticipant;
      return userData?.avatarUrl;
    }
  };

  const prev = index + 1 < messages.length ? messages[index + 1] : undefined;

  const isShowTime =
    index === 0 ||
    new Date(message.createdAt).getTime() -
      new Date(prev?.createdAt || 0).getTime() >
      300000; // 5 phút

  const isGroupBreak = isShowTime || message.senderId !== prev?.senderId;

  // Get sender info - handle both populated and non-populated senderId
  const getSenderInfo = () => {
    // If message has sender object directly
    if (message.sender) {
      return {
        displayName: message.sender.displayName,
        avatarUrl: message.sender.avatarUrl
      };
    }
    
    // Try to find from participants
    const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId?._id;
    const participant = selectedConvo.participants?.find(
      (p: any) => {
        const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
        return pId?.toString() === senderId?.toString();
      }
    );
    
    if (participant) {
      // Handle different participant structures
      const userData = participant.userId || participant;
      return {
        displayName: userData.displayName || 'Unknown',
        avatarUrl: userData.avatarUrl
      };
    }
    
    return {
      displayName: 'Unknown',
      avatarUrl: undefined
    };
  };

  const senderInfo = getSenderInfo();

  const handleEdit = () => {
    setEditContent(message.content);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      toast.error("Nội dung tin nhắn không được để trống");
      return;
    }

    try {
      await editMessage(message._id, editContent);
      setIsEditDialogOpen(false);
      toast.success("Đã chỉnh sửa tin nhắn");
    } catch (error) {
      toast.error("Không thể chỉnh sửa tin nhắn");
    }
  };

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  const handleReaction = async (emoji: string) => {
    try {
      await addReaction(message._id, emoji);
      setIsReactionPickerOpen(false);
    } catch (error) {
      toast.error("Không thể thêm reaction");
    }
  };

  const handleForward = () => {
    setSelectedConversations([]);
    setSearchQuery("");
    setIsForwardDialogOpen(true);
  };

  const handleSaveForward = async () => {
    if (selectedConversations.length === 0) {
      toast.error("Vui lòng chọn ít nhất một cuộc trò chuyện");
      return;
    }

    try {
      await forwardMessage(message._id, selectedConversations);
      setIsForwardDialogOpen(false);
      toast.success(`Đã chuyển tiếp tin nhắn tới ${selectedConversations.length} cuộc trò chuyện`);
    } catch (error) {
      console.error("Error forwarding:", error);
      toast.error("Không thể chuyển tiếp tin nhắn");
    }
  };

  const toggleConversationSelection = (conversationId: string) => {
    setSelectedConversations(prev =>
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  return (
    <>
      {/* time */}
      {isShowTime && (
        <span className="flex justify-center text-xs text-muted-foreground px-1">
          {formatMessageTime(new Date(message.createdAt))}
        </span>
      )}

      {/* Call ended message */}
      {message.type === 'call' || (message.type === 'system' && message.content?.includes('Call ended')) ? (
        <div className={cn(
          "flex my-4",
          message.isOwn ? "justify-end" : "justify-start"
        )}>
          {message.callMetadata ? (
            <CallEndedMessage
              callType={message.callMetadata.callType}
              duration={message.callMetadata.duration}
              caller={message.callMetadata.caller}
              onCallAgain={() => {
                const { initiateCall } = useCallStore.getState();
                const otherParticipant = selectedConvo.participants?.find((p: any) => {
                  const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
                  return pId?.toString() !== user?._id;
                });
                
                if (otherParticipant) {
                  const userData = typeof otherParticipant === 'object' && otherParticipant?.userId
                    ? otherParticipant.userId
                    : otherParticipant;
                  
                  const receiverId = typeof userData === 'string' ? userData : userData._id;
                  const receiverInfo = {
                    _id: receiverId,
                    displayName: userData?.displayName || 'Unknown',
                    avatarUrl: userData?.avatarUrl
                  };
                  
                  initiateCall(
                    selectedConvo._id,
                    receiverId,
                    receiverInfo,
                    message.callMetadata.callType
                  );
                }
              }}
            />
          ) : (
            // Parse old system messages and create CallEndedMessage
            (() => {
              // Parse duration from "Call ended. Duration: 0m 13s"
              const match = message.content?.match(/Duration: (\d+)m (\d+)s/);
              const mins = match ? parseInt(match[1]) : 0;
              const secs = match ? parseInt(match[2]) : 0;
              const duration = mins * 60 + secs;
              
              // Get sender info
              const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId?._id;
              const senderParticipant = selectedConvo.participants?.find((p: any) => {
                const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
                return pId?.toString() === senderId?.toString();
              });
              
              const senderData = senderParticipant?.userId || senderParticipant || message.sender;
              const caller = {
                _id: senderId || '',
                displayName: senderData?.displayName || 'Unknown',
                avatarUrl: senderData?.avatarUrl
              };
              
              return (
                <CallEndedMessage
                  callType="audio" // Default to audio for old messages
                  duration={duration}
                  caller={caller}
                  onCallAgain={() => {
                    const { initiateCall } = useCallStore.getState();
                    const otherParticipant = selectedConvo.participants?.find((p: any) => {
                      const pId = typeof p === 'string' ? p : (p._id || p.userId?._id);
                      return pId?.toString() !== user?._id;
                    });
                    
                    if (otherParticipant) {
                      const userData = typeof otherParticipant === 'object' && otherParticipant?.userId
                        ? otherParticipant.userId
                        : otherParticipant;
                      
                      const receiverId = typeof userData === 'string' ? userData : userData._id;
                      const receiverInfo = {
                        _id: receiverId,
                        displayName: userData?.displayName || 'Unknown',
                        avatarUrl: userData?.avatarUrl
                      };
                      
                      initiateCall(
                        selectedConvo._id,
                        receiverId,
                        receiverInfo,
                        'audio'
                      );
                    }
                  }}
                />
              );
            })()
          )}
        </div>
      ) : null}

      {/* Regular message */}
      {message.type !== 'call' && message.type !== 'system' && (
      <div
        className={cn(
          "flex gap-2 message-bounce mt-1 group",
          message.isOwn ? "justify-end" : "justify-start"
        )}
      >
        {/* avatar */}
        {!message.isOwn && (
          <div className="w-8">
            {isGroupBreak && (
              <UserAvatar
                type="chat"
                name={senderInfo.displayName}
                avatarUrl={senderInfo.avatarUrl}
              />
            )}
          </div>
        )}

        {/* tin nhắn */}
        <div
          className={cn(
            "max-w-xs lg:max-w-md space-y-1 flex flex-col relative",
            message.isOwn ? "items-end" : "items-start"
          )}
        >
          <div className="flex items-center gap-2">
            {message.isOwn && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Popover open={isReactionPickerOpen} onOpenChange={setIsReactionPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      😊
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <EmojiPicker onChange={handleReaction} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            
            <Card
              className={cn(
                "p-3",
                message.isOwn ? "chat-bubble-sent border-0" : "chat-bubble-received"
              )}
            >
              {/* Reply preview */}
              {message.replyTo && (
                <div className="mb-2 p-2 bg-muted/50 rounded border-l-2 border-primary">
                  <p className="text-xs font-medium text-primary mb-0.5">
                    {message.replyTo.sender?.displayName || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {message.replyTo.content}
                  </p>
                </div>
              )}
              
              {/* File attachment */}
              {message.type === 'image' && message.fileUrl && (
                <div className="relative group/image">
                  <img 
                    src={message.fileUrl} 
                    alt="Attachment" 
                    className="max-w-full rounded mb-2 cursor-pointer hover:opacity-90"
                    onClick={() => window.open(message.fileUrl, '_blank')}
                  />
                  <a
                    href={message.fileUrl}
                    download={message.fileName || 'image'}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              )}
              
              {message.type === 'file' && message.fileUrl && (
                <a 
                  href={message.fileUrl} 
                  download={message.fileName}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded mb-2 hover:bg-muted transition-colors group/file"
                >
                  <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center shrink-0">
                    <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{message.fileName || 'File'}</p>
                    {message.fileSize && (
                      <p className="text-xs text-muted-foreground">
                        {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <svg className="h-5 w-5 text-muted-foreground group-hover/file:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}
              
              {message.content && (
                <p className="text-sm leading-relaxed break-words">{message.content}</p>
              )}
              
              {message.isEdited && (
                <span className="text-xs text-amber-600 dark:text-amber-400 italic mt-1 block">
                  (đã chỉnh sửa)
                </span>
              )}
            </Card>

            {!message.isOwn && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Popover open={isReactionPickerOpen} onOpenChange={setIsReactionPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      😊
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <EmojiPicker onChange={handleReaction} />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MessageContextMenu
                messageId={message._id}
                content={message.content}
                isOwn={message.isOwn}
                conversationId={selectedConvo._id}
                onEdit={handleEdit}
                onReply={handleReply}
                onReact={() => setIsReactionPickerOpen(true)}
                onForward={handleForward}
              />
            </div>
          </div>

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {message.reactions.map((reaction, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-2 py-0.5 cursor-pointer hover:bg-muted"
                >
                  {reaction.emoji} {reaction.count > 1 && reaction.count}
                </Badge>
              ))}
            </div>
          )}

          {/* seen/ delivered */}
          {message.isOwn && message._id === selectedConvo.lastMessage?._id && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs px-1.5 py-0.5 h-4 border-0",
                lastMessageStatus === "seen"
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {lastMessageStatus === "seen" ? "Đã xem" : "Đã gửi"}
            </Badge>
          )}
        </div>
      </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa tin nhắn</DialogTitle>
            <DialogDescription>
              Thay đổi nội dung tin nhắn của bạn
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Nhập nội dung tin nhắn..."
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveEdit}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
        <DialogContent className="max-h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Chuyển tiếp tin nhắn</DialogTitle>
            <DialogDescription>
              Chọn cuộc hội thoại để chuyển tiếp tin nhắn
            </DialogDescription>
          </DialogHeader>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm cuộc trò chuyện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[400px]">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Không tìm thấy cuộc trò chuyện" : "Chưa có cuộc trò chuyện"}
              </div>
            ) : (
              filteredConversations.map((convo) => {
                const isSelected = selectedConversations.includes(convo._id);
                const conversationName = getConversationName(convo);
                const conversationAvatar = getConversationAvatar(convo);

                return (
                  <div
                    key={convo._id}
                    onClick={() => toggleConversationSelection(convo._id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted"
                    )}
                  >
                    <UserAvatar
                      type="chat"
                      name={conversationName}
                      avatarUrl={conversationAvatar}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{conversationName}</p>
                      {convo.type === 'group' && (
                        <p className="text-sm text-muted-foreground truncate">
                          {convo.participants?.length || 0} thành viên
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsForwardDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveForward} disabled={selectedConversations.length === 0}>
              Chuyển tiếp ({selectedConversations.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MessageItem;
