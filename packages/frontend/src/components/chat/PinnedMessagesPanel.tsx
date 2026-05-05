import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useChatStore } from "@/stores/useChatStore";
import type { Message } from "@/types/chat";
import { Pin, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PinnedMessagesPanelProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PinnedMessagesPanel({
  conversationId,
  isOpen,
  onClose,
}: PinnedMessagesPanelProps) {
  const { getPinnedMessages, unpinMessage } = useChatStore();
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadPinnedMessages();
    }
  }, [isOpen, conversationId]);

  const loadPinnedMessages = async () => {
    setLoading(true);
    try {
      const messages = await getPinnedMessages(conversationId);
      setPinnedMessages(messages);
    } catch (error) {
      toast.error("Không thể tải tin nhắn đã ghim");
    } finally {
      setLoading(false);
    }
  };

  const handleUnpin = async (messageId: string) => {
    try {
      await unpinMessage(conversationId, messageId);
      setPinnedMessages((prev) => prev.filter((m) => m._id !== messageId));
      toast.success("Đã bỏ ghim tin nhắn");
    } catch (error) {
      toast.error("Không thể bỏ ghim");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pin className="h-5 w-5" />
            Tin nhắn đã ghim
          </SheetTitle>
          <SheetDescription>
            {pinnedMessages.length} tin nhắn được ghim
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Pin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có tin nhắn nào được ghim</p>
            </div>
          ) : (
            pinnedMessages.map((message) => (
              <div
                key={message._id}
                className="group relative p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <button
                  onClick={() => handleUnpin(message._id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
                <p className="text-sm pr-6">{message.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(message.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
