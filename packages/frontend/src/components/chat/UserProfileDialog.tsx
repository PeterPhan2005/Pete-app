import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import UserAvatar from "./UserAvatar";
import { friendService } from "@/services/friendService";
import { toast } from "sonner";
import { UserX, UserCheck, UserPlus, UserMinus, X } from "lucide-react";
import type { User } from "@/types/user";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

interface FriendshipStatus {
  status: 'self' | 'friends' | 'blocked' | 'pending' | 'none';
  direction?: 'sent' | 'received';
  blockedBy?: string;
  friendship?: any;
  request?: any;
}

const UserProfileDialog = ({ open, onOpenChange, user }: UserProfileDialogProps) => {
  const { user: currentUser } = useAuthStore();
  const { getAllFriendRequests, getFriends } = useFriendStore();
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);

  const fetchFriendshipStatus = async () => {
    if (!user) return;
    
    try {
      const res = await friendService.getFriendshipStatus(user._id);
      setFriendshipStatus(res.data);
    } catch (error: any) {
      console.error("Error fetching friendship status:", error);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchFriendshipStatus();
    }
  }, [open, user?._id]);

  const handleBlock = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await friendService.blockFriend(user._id);
      toast.success("Đã chặn người dùng");
      await fetchFriendshipStatus();
      await getFriends();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await friendService.unblockFriend(user._id);
      toast.success("Đã bỏ chặn người dùng");
      await fetchFriendshipStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await friendService.unfriend(user._id);
      toast.success("Đã hủy kết bạn");
      await fetchFriendshipStatus();
      await getFriends();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await friendService.sendFriendRequest(user._id);
      toast.success("Đã gửi lời mời kết bạn");
      await fetchFriendshipStatus();
      await getAllFriendRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!user || !friendshipStatus?.request?._id) return;

    setIsLoading(true);
    try {
      await friendService.cancelRequest(friendshipStatus.request._id);
      toast.success("Đã hủy lời mời kết bạn");
      await fetchFriendshipStatus();
      await getAllFriendRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  const isBlocked = friendshipStatus?.status === 'blocked';
  const isBlockedByMe = isBlocked && friendshipStatus?.blockedBy === currentUser?._id;
  const isFriend = friendshipStatus?.status === 'friends';
  const isPending = friendshipStatus?.status === 'pending';
  const isPendingSent = isPending && friendshipStatus?.direction === 'sent';
  const isNone = friendshipStatus?.status === 'none';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-strong border-border/30 max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin người dùng</DialogTitle>
            <DialogDescription>
              Xem thông tin chi tiết và quản lý mối quan hệ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Avatar and Name */}
            <div className="flex flex-col items-center gap-4">
              <UserAvatar
                type="profile"
                name={user.displayName}
                avatarUrl={user.avatarUrl}
              />
              <div className="text-center">
                <h3 className="text-xl font-semibold">{user.displayName}</h3>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>

            {/* Bio */}
            {user.bio && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Giới thiệu</p>
                  <p className="text-sm text-muted-foreground">{user.bio}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              {/* Friend Actions */}
              {isFriend && !isBlocked && (
                <Button
                  variant="outline"
                  className="w-full justify-start glass-light border-border/30"
                  onClick={() => setShowUnfriendConfirm(true)}
                  disabled={isLoading}
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Hủy kết bạn
                </Button>
              )}

              {isNone && !isBlocked && (
                <Button
                  variant="outline"
                  className="w-full justify-start glass-light border-border/30"
                  onClick={handleAddFriend}
                  disabled={isLoading}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Kết bạn
                </Button>
              )}

              {isPendingSent && (
                <Button
                  variant="outline"
                  className="w-full justify-start glass-light border-border/30"
                  onClick={handleCancelRequest}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Hủy lời mời kết bạn
                </Button>
              )}

              {isPending && friendshipStatus?.direction === 'received' && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  Đã nhận lời mời kết bạn
                </div>
              )}

              {/* Block Actions */}
              {isBlockedByMe ? (
                <Button
                  variant="outline"
                  className="w-full justify-start glass-light border-border/30 hover:bg-primary/10"
                  onClick={() => setShowUnblockConfirm(true)}
                  disabled={isLoading}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Bỏ chặn
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start glass-light border-border/30 hover:text-destructive"
                  onClick={() => setShowBlockConfirm(true)}
                  disabled={isLoading || isBlocked}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Chặn người dùng
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={showBlockConfirm}
        onOpenChange={setShowBlockConfirm}
        onConfirm={handleBlock}
        title="Chặn người dùng"
        description={`Bạn có chắc muốn chặn ${user.displayName}? Bạn sẽ không thể nhắn tin với người này và mối quan hệ bạn bè sẽ bị hủy.`}
        confirmText="Chặn"
        cancelText="Hủy"
        variant="destructive"
      />

      <ConfirmDialog
        open={showUnblockConfirm}
        onOpenChange={setShowUnblockConfirm}
        onConfirm={handleUnblock}
        title="Bỏ chặn người dùng"
        description={`Bạn có chắc muốn bỏ chặn ${user.displayName}?`}
        confirmText="Bỏ chặn"
        cancelText="Hủy"
      />

      <ConfirmDialog
        open={showUnfriendConfirm}
        onOpenChange={setShowUnfriendConfirm}
        onConfirm={handleUnfriend}
        title="Hủy kết bạn"
        description={`Bạn có chắc muốn hủy kết bạn với ${user.displayName}?`}
        confirmText="Hủy kết bạn"
        cancelText="Hủy"
        variant="destructive"
      />
    </>
  );
};

export default UserProfileDialog;
