import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useCallStore } from "@/stores/useCallStore";
import UserAvatar from "../chat/UserAvatar";

export const IncomingCallDialog = () => {
  const { callStatus, caller, callType, callId, roomId, acceptCall, declineCall } = useCallStore();
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (callStatus === "ringing") {
      setIsRinging(true);
      
      // Play ringtone (optional)
      // const audio = new Audio("/ringtone.mp3");
      // audio.loop = true;
      // audio.play();
      
      return () => {
        setIsRinging(false);
        // audio.pause();
      };
    }
  }, [callStatus]);

  const handleAccept = async () => {
    if (callId && roomId && caller) {
      try {
        await acceptCall(callId, roomId, caller);
      } catch (error) {
        console.error("Error accepting call:", error);
      }
    }
  };

  const handleDecline = () => {
    if (callId) {
      declineCall(callId);
    }
  };

  if (!isRinging || !caller) return null;

  return (
    <Dialog open={isRinging} onOpenChange={(open) => !open && handleDecline()}>
      <DialogContent className="sm:max-w-md glass-strong border-border/30">
        <DialogTitle className="sr-only">Cuộc gọi đến</DialogTitle>
        <DialogDescription className="sr-only">
          {callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"} từ {caller.displayName}
        </DialogDescription>
        <div className="flex flex-col items-center gap-6 py-6">
          {/* Caller Avatar */}
          <div className="relative">
            <div className={`${isRinging ? 'animate-pulse' : ''}`}>
              <UserAvatar
                type="profile"
                name={caller.displayName}
                avatarUrl={caller.avatarUrl}
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-2">
              {callType === "video" ? (
                <Video className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Phone className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
          </div>

          {/* Caller Info */}
          <div className="text-center">
            <h3 className="text-xl font-semibold">{caller.displayName}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {callType === "video" ? "Cuộc gọi video đến..." : "Cuộc gọi thoại đến..."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <Button
              variant="destructive"
              size="lg"
              className="flex-1"
              onClick={handleDecline}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              Từ chối
            </Button>
            <Button
              variant="default"
              size="lg"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
            >
              <Phone className="h-5 w-5 mr-2" />
              Chấp nhận
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
