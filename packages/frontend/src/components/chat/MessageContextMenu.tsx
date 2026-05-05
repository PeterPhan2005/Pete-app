import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Copy,
  Edit,
  Forward,
  MoreVertical,
  Pin,
  Reply,
  Smile,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface MessageContextMenuProps {
  messageId: string;
  content: string;
  isOwn: boolean;
  conversationId: string;
  isPinned?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onReact?: () => void;
  onForward?: () => void;
}

export function MessageContextMenu({
  messageId,
  content,
  isOwn,
  conversationId,
  isPinned = false,
  onReply,
  onEdit,
  onReact,
  onForward,
}: MessageContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    deleteMessage,
    pinMessage,
    unpinMessage,
    conversations,
  } = useChatStore();
  const { user } = useAuthStore();

  const currentConvo = conversations.find((c) => c._id === conversationId);
  const canManagePin = (() => {
    if (!currentConvo || currentConvo.type !== "group") return true;
    if (!user?._id) return false;

    const normalizeId = (value: any) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      return value._id?.toString?.() || value.toString?.() || "";
    };

    const userId = normalizeId(user);
    const creatorId = normalizeId(currentConvo.createdBy);
    const isCreator = creatorId === userId;

    const isAdminByAdminsField = (currentConvo.admins || []).some(
      (admin) => normalizeId(admin) === userId
    );

    const isAdminByParticipantRole = (currentConvo.participants || []).some(
      (participant) =>
        normalizeId(participant?._id) === userId && participant?.role === "admin"
    );

    return Boolean(isCreator || isAdminByAdminsField || isAdminByParticipantRole);
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Đã copy tin nhắn");
    setIsOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMessage(messageId);
      toast.success("Đã xóa tin nhắn");
    } catch (error) {
      toast.error("Không thể xóa tin nhắn");
    }
    setIsOpen(false);
  };

  const handlePin = async () => {
    try {
      if (isPinned) {
        await unpinMessage(conversationId, messageId);
        toast.success("Đã bỏ ghim tin nhắn");
      } else {
        await pinMessage(conversationId, messageId);
        toast.success("Đã ghim tin nhắn");
      }
    } catch (error) {
      toast.error("Không thể thực hiện");
    }
    setIsOpen(false);
  };

  const handleReact = () => {
    if (onReact) {
      onReact();
    }
    setIsOpen(false);
  };

  const handleForward = () => {
    if (onForward) {
      onForward();
    }
    setIsOpen(false);
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit();
    }
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleReact}>
          <Smile className="h-4 w-4 mr-2" />
          Thêm reaction
        </DropdownMenuItem>
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <Reply className="h-4 w-4 mr-2" />
            Trả lời
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleForward}>
          <Forward className="h-4 w-4 mr-2" />
          Chuyển tiếp
        </DropdownMenuItem>
        {canManagePin && (
          <DropdownMenuItem onClick={handlePin}>
            <Pin className="h-4 w-4 mr-2" />
            {isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
          </DropdownMenuItem>
        )}
        {isOwn && (
          <>
            <DropdownMenuSeparator />
            {onEdit && (
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Chỉnh sửa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
