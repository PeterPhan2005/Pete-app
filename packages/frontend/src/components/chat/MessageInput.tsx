import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation, Message } from "@/types/chat";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { ImagePlus, Send, X, Paperclip } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  selectedConvo: Conversation;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

const MessageInput = ({ selectedConvo, replyingTo, onCancelReply }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const { sendDirectMessage, sendGroupMessage, sendMessageWithFile } = useChatStore();
  const [value, setValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Emit typing event
  const emitTyping = useCallback((typing: boolean) => {
    if (socket && selectedConvo._id) {
      socket.emit("typing", {
        conversationId: selectedConvo._id,
        isTyping: typing
      });
      setIsTyping(typing);
    }
  }, [socket, selectedConvo._id]);

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Emit typing based on whether there's text
    const hasText = newValue.trim().length > 0;
    if (hasText !== isTyping) {
      emitTyping(hasText);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTyping) {
        emitTyping(false);
      }
    };
  }, [isTyping, emitTyping]);

  // Early return after all hooks
  if (!user) return null;

  // Check if user can send messages in group
  const canSendMessage = () => {
    if (selectedConvo.type === 'direct') return true;
    
    // For group chats, check if onlyAdminsCanSend is enabled
    if (selectedConvo.settings?.onlyAdminsCanSend) {
      const isCreator = selectedConvo.createdBy?.toString() === user._id;
      const isAdmin = selectedConvo.admins?.some((admin: any) => {
        const adminId = typeof admin === 'string' ? admin : admin._id;
        return adminId?.toString() === user._id;
      });
      return isCreator || isAdmin;
    }
    
    return true;
  };

  const isBlocked = !canSendMessage();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast.error("Kích thước file không được vượt quá 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if (!value.trim() && !selectedFile) return;
    
    const currValue = value;
    const currFile = selectedFile;
    const replyToId = replyingTo?._id;
    
    setValue("");
    clearFile();
    if (onCancelReply) onCancelReply();
    
    // Stop typing indicator
    emitTyping(false);

    try {
      setIsUploading(true);

      if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.filter((p) => p._id !== user._id)[0];
        
        if (currFile) {
          await sendMessageWithFile(
            selectedConvo._id,
            currValue,
            currFile,
            replyToId
          );
        } else {
          await sendDirectMessage(
            otherUser._id,
            currValue,
            undefined,
            selectedConvo._id,
            replyToId
          );
        }
      } else {
        if (currFile) {
          await sendMessageWithFile(
            selectedConvo._id,
            currValue,
            currFile,
            replyToId
          );
        } else {
          await sendGroupMessage(selectedConvo._id, currValue, undefined, replyToId);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isBlocked) {
        sendMessage();
      }
    }
  };

  // If blocked, show blocked message
  if (isBlocked) {
    return (
      <div className="bg-background border-t">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Chỉ quản trị viên được phép nhắn</h3>
          <p className="text-sm text-muted-foreground">
            Trưởng nhóm đã bật chế độ chỉ quản trị viên mới có thể gửi tin nhắn trong nhóm này
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background border-t">
      {/* Reply preview */}
      {replyingTo && (
        <div className="px-3 pt-3 pb-2 border-b bg-muted/30">
          <div className="flex items-start gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-primary">Trả lời</span>
                <span className="text-xs text-muted-foreground">
                  {replyingTo.sender?.displayName || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {replyingTo.content}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onCancelReply}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="px-3 pt-3 pb-2 border-b">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-12 w-12 object-cover rounded"
              />
            ) : (
              <div className="h-12 w-12 bg-primary/10 rounded flex items-center justify-center">
                <Paperclip className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={clearFile}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />
        
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Paperclip className="size-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            onKeyPress={handleKeyPress}
            value={value}
            onChange={handleInputChange}
            placeholder="Soạn tin nhắn..."
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
            disabled={isUploading}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => setValue(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={sendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={(!value.trim() && !selectedFile) || isUploading}
        >
          <Send className="size-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
