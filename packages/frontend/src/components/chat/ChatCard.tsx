import { Card } from "@/components/ui/card";
import { formatOnlineTime, cn } from "@/lib/utils";
import { MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/useChatStore";
import { toast } from "sonner";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ChatCardProps {
  convoId: string;
  name: string;
  timestamp?: Date;
  isActive: boolean;
  onSelect: (id: string) => void;
  unreadCount?: number;
  leftSection: React.ReactNode;
  subtitle: React.ReactNode;
}

const ChatCard = ({
  convoId,
  name,
  timestamp,
  isActive,
  onSelect,
  unreadCount,
  leftSection,
  subtitle,
}: ChatCardProps) => {
  const { deleteConversation, setActiveConversation } = useChatStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteConversation(convoId);
      if (isActive) {
        setActiveConversation(null);
      }
      toast.success("Đã xóa cuộc trò chuyện");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  return (
    <>
      <Card
        key={convoId}
        className={cn(
          "border-none p-3 cursor-pointer transition-smooth glass hover:bg-muted/30 group",
          isActive &&
            "ring-2 ring-primary/50 bg-gradient-to-tr from-primary-glow/10 to-primary-foreground"
        )}
        onClick={() => onSelect(convoId)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">{leftSection}</div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3
                className={cn(
                  "font-semibold text-sm truncate",
                  unreadCount && unreadCount > 0 && "text-foreground"
                )}
              >
                {name}
              </h3>

              <span className="text-xs text-muted-foreground">
                {timestamp ? formatOnlineTime(timestamp) : ""}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-1 min-w-0">{subtitle}</div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong border-border/30">
                  <DropdownMenuItem
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa cuộc trò chuyện
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Xóa cuộc trò chuyện"
        description={`Bạn có chắc muốn xóa cuộc trò chuyện với ${name}? Bạn sẽ không nhận được thông báo từ cuộc trò chuyện này nữa cho đến khi có tin nhắn mới.`}
        confirmText="Xóa"
        cancelText="Hủy"
        variant="destructive"
      />
    </>
  );
};

export default ChatCard;
