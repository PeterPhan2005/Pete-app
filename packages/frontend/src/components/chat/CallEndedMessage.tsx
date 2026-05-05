import { Video, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserAvatar from "./UserAvatar";

interface CallEndedMessageProps {
  callType: "audio" | "video";
  duration: number;
  caller: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  onCallAgain?: () => void;
}

export const CallEndedMessage = ({ callType, duration, caller, onCallAgain }: CallEndedMessageProps) => {
  // Format duration as "X phút Y giây"
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs} giây`;
  };

  return (
    <div className="max-w-xs bg-card rounded-lg shadow-sm p-4 space-y-3 border border-border">
      {/* Header with Avatar and Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-border flex-shrink-0">
          <UserAvatar
            type="chat"
            name={caller.displayName}
            avatarUrl={caller.avatarUrl}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">
            {callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến"}
          </h4>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {callType === "video" ? (
              <Video className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Phone className="h-3.5 w-3.5 text-green-500" />
            )}
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      {/* Call Again Button */}
      {onCallAgain && (
        <Button
          size="sm"
          onClick={onCallAgain}
          className="w-full bg-primary hover:bg-primary/90"
        >
          Gọi lại
        </Button>
      )}
    </div>
  );
};
