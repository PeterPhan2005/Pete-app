import { Button } from "../ui/button";
import { Info } from "lucide-react";
import { useState } from "react";
import { friendService } from "@/services/friendService";
import { toast } from "sonner";

interface BlockedUserMessageProps {
  message: string;
  isBlockedByMe: boolean;
  otherUserId: string;
  onUnblock?: () => void;
}

const BlockedUserMessage = ({ message, isBlockedByMe, otherUserId, onUnblock }: BlockedUserMessageProps) => {
  const [isUnblocking, setIsUnblocking] = useState(false);

  const handleUnblock = async () => {
    try {
      setIsUnblocking(true);
      await friendService.unblockFriend(otherUserId);
      toast.success("Đã bỏ chặn thành công");
      if (onUnblock) {
        onUnblock();
      }
    } catch (error) {
      console.error("Error unblocking:", error);
      toast.error("Không thể bỏ chặn");
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <div className="border-t bg-muted/30 p-3 flex items-center justify-center gap-2">
      <Info className="h-4 w-4 text-blue-500" />
      <span className="text-sm text-muted-foreground">{message}.</span>
      {isBlockedByMe && (
        <Button
          variant="link"
          size="sm"
          onClick={handleUnblock}
          disabled={isUnblocking}
          className="text-blue-500 hover:text-blue-600 p-0 h-auto font-normal"
        >
          Bỏ chặn
        </Button>
      )}
    </div>
  );
};

export default BlockedUserMessage;
