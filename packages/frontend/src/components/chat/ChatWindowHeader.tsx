import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { SidebarTrigger } from "../ui/sidebar";
import { useAuthStore } from "@/stores/useAuthStore";
import { Separator } from "../ui/separator";
import UserAvatar from "./UserAvatar";
import StatusBadge from "./StatusBadge";
import GroupChatAvatar from "./GroupChatAvatar";
import { useSocketStore } from "@/stores/useSocketStore";
import { useCallStore } from "@/stores/useCallStore";
import { formatLastSeen } from "@/lib/utils";
import { useState } from "react";
import UserProfileDialog from "./UserProfileDialog";
import SearchMessagesDialog from "./SearchMessagesDialog";
import { GroupManagementDialog } from "./GroupManagementDialog";
import { MoreVertical, Trash2, Search, Settings, Phone, Video } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ChatWindowHeader = ({ chat }: { chat?: Conversation }) => {
  const { conversations, activeConversationId, setActiveConversation, deleteConversation } = useChatStore();
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();
  const { initiateCall } = useCallStore();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showSearchMessages, setShowSearchMessages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);

  chat = chat ?? (conversations || []).find((c) => c._id === activeConversationId);

  // If no chat found, show minimal header
  if (!chat) {
    return (
      <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 px-4 py-2 w-full">
        <SidebarTrigger className="-ml-1 text-foreground" />
      </header>
    );
  }

  let otherUser: any = null;
  if (chat.type === "direct") {
    const otherUsers = chat.participants?.filter((p) => p._id !== user?._id) || [];
    otherUser = otherUsers.length > 0 ? otherUsers[0] : null;

    // Early return after all hooks
    if (!user || !otherUser) return null;
  }

  const isOnline = onlineUsers.includes(otherUser?._id ?? "");

  const handleDeleteConversation = async () => {
    try {
      await deleteConversation(chat._id);
      setActiveConversation(null);
      toast.success("Đã xóa cuộc trò chuyện");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const handleHeaderClick = () => {
    if (chat.type === "direct") {
      setShowUserProfile(true);
    } else {
      setShowGroupManagement(true);
    }
  };

  const handleCall = async (callType: "audio" | "video") => {
    if (!chat || !otherUser || !user) return;

    try {
      await initiateCall(
        chat._id,
        otherUser._id,
        {
          _id: otherUser._id,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl,
        },
        callType
      );
    } catch (error) {
      console.error("Error initiating call:", error);
      toast.error("Không thể bắt đầu cuộc gọi");
    }
  };

  const chatName = chat.type === "direct" ? otherUser?.displayName : chat.group?.name;

  return (
    <>
      <header className="sticky top-0 z-10 px-4 py-2 flex items-center justify-between bg-background border-b">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 text-foreground" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />

          <div 
            className="p-2 flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded-lg transition-colors"
            onClick={handleHeaderClick}
          >
            {/* avatar */}
            <div className="relative">
              {chat.type === "direct" ? (
                <>
                  <UserAvatar
                    type={"sidebar"}
                    name={otherUser?.displayName || "Pete"}
                    avatarUrl={otherUser?.avatarUrl || undefined}
                  />
                  <StatusBadge status={isOnline ? "online" : "offline"} />
                </>
              ) : (
                <GroupChatAvatar
                  participants={chat.participants}
                  type="sidebar"
                />
              )}
            </div>

            {/* name and status */}
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground">
                {chatName}
              </h2>
              {chat.type === "direct" && (
                <span className="text-xs text-muted-foreground">
                  {isOnline ? "Đang hoạt động" : formatLastSeen(otherUser?.lastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Call buttons (only for direct chat) */}
          {chat.type === "direct" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCall("audio")}
                className="text-muted-foreground hover:text-foreground"
                title="Gọi thoại"
              >
                <Phone className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCall("video")}
                className="text-muted-foreground hover:text-foreground"
                title="Gọi video"
              >
                <Video className="h-5 w-5" />
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearchMessages(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-strong border-border/30">
              {chat.type === "group" && (
                <DropdownMenuItem onClick={() => setShowGroupManagement(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Quản lý nhóm
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Xóa cuộc trò chuyện
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* User Profile Dialog */}
      {chat.type === "direct" && otherUser && (
        <UserProfileDialog
          open={showUserProfile}
          onOpenChange={setShowUserProfile}
          user={otherUser as any}
        />
      )}

      {/* Search Messages Dialog */}
      <SearchMessagesDialog
        open={showSearchMessages}
        onOpenChange={setShowSearchMessages}
        conversationId={chat._id}
      />

      {/* Group Management Dialog */}
      {chat.type === "group" && (
        <GroupManagementDialog
          conversation={chat}
          isOpen={showGroupManagement}
          onClose={() => setShowGroupManagement(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConversation}
        title="Xóa cuộc trò chuyện"
        description={`Bạn có chắc muốn xóa cuộc trò chuyện với ${chatName}? Bạn sẽ không nhận được thông báo từ cuộc trò chuyện này nữa cho đến khi có tin nhắn mới.`}
        confirmText="Xóa"
        cancelText="Hủy"
        variant="destructive"
      />
    </>
  );
};

export default ChatWindowHeader;
