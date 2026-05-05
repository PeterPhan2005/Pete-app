import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { friendService } from "@/services/friendService";
import { toast } from "sonner";
import { Search, UserX, UserCheck } from "lucide-react";
import UserAvatar from "../chat/UserAvatar";
import type { User } from "@/types/user";

interface BlockedUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BlockedFriend {
  _id: string;
  friendId: User;
  blockedAt: string;
}

const BlockedUsersDialog = ({ open, onOpenChange }: BlockedUsersDialogProps) => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBlockedUsers();
    }
  }, [open]);

  const fetchBlockedUsers = async () => {
    setIsLoading(true);
    try {
      const res = await friendService.getBlockedFriends();
      setBlockedUsers(res.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tải danh sách chặn");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (friendId: string) => {
    if (!confirm("Bạn có chắc muốn bỏ chặn người dùng này?")) {
      return;
    }

    try {
      await friendService.unblockFriend(friendId);
      toast.success("Đã bỏ chặn thành công");
      fetchBlockedUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const filteredUsers = blockedUsers.filter((blocked) =>
    blocked.friendId.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    blocked.friendId.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Danh sách chặn
          </DialogTitle>
          <DialogDescription>
            Quản lý người dùng bạn đã chặn
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm người đã chặn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-light border-border/30 pl-10"
            />
          </div>

          {/* Blocked users list */}
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Không tìm thấy người dùng" : "Bạn chưa chặn ai"}
              </div>
            ) : (
              filteredUsers.map((blocked) => (
                <div
                  key={blocked._id}
                  className="flex items-center justify-between p-3 glass-light rounded-lg border border-border/30"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      user={blocked.friendId}
                      size="md"
                    />
                    <div>
                      <p className="font-medium">{blocked.friendId.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        @{blocked.friendId.username}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnblock(blocked.friendId._id)}
                    className="glass-light border-border/30 hover:bg-primary/10"
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Bỏ chặn
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BlockedUsersDialog;
