import type { UseFormRegister } from "react-hook-form";
import type { IFormValues } from "../chat/AddFriendModal";
import type { User } from "@/types/user";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { UserPlus } from "lucide-react";
import UserAvatar from "../chat/UserAvatar";

interface SendRequestProps {
  register: UseFormRegister<IFormValues>;
  loading: boolean;
  searchedUser?: User;
  isFriend?: boolean;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}

const SendFriendRequestForm = ({
  register,
  loading,
  searchedUser,
  isFriend = false,
  onSubmit,
  onBack,
}: SendRequestProps) => {
  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        {/* User Info Card */}
        {searchedUser && (
          <div className="flex items-center gap-3 p-3 rounded-lg glass border border-border/30">
            <UserAvatar
              type="sidebar"
              name={searchedUser.displayName}
              avatarUrl={searchedUser.avatarUrl}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{searchedUser.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">@{searchedUser.username}</p>
              {searchedUser.email && (
                <p className="text-xs text-muted-foreground truncate">{searchedUser.email}</p>
              )}
            </div>
          </div>
        )}

        {isFriend ? (
          <span className="text-muted-foreground text-sm">
            Bạn đã là bạn bè hoặc đã gửi lời mời kết bạn cho người dùng này rồi!
          </span>
        ) : (
          <span className="text-sm text-green-600 dark:text-green-400">
            Tìm thấy người dùng 🎉
          </span>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="message"
            className="text-sm font-semibold"
          >
            Lời nhắn (tùy chọn)
          </Label>
          <Textarea
            id="message"
            rows={3}
            placeholder="Chào bạn ~ Có thể kết bạn được không?..."
            className="glass border-border/50 focus:border-primary/50 transition-smooth resize-none"
            {...register("message")}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="flex-1 glass hover:text-destructive"
            onClick={onBack}
          >
            Quay lại
          </Button>

          <Button
            type="submit"
            disabled={loading || isFriend}
            className="flex-1 bg-gradient-chat text-white hover:opactity-90 transition-smooth"
          >
            {loading ? (
              <span>Đang gửi...</span>
            ) : isFriend ? (
              <span>Đã kết bạn</span>
            ) : (
              <>
                <UserPlus className="size-4 mr-2" /> Kết Bạn
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    </form>
  );
};

export default SendFriendRequestForm;
