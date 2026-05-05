import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, X } from "lucide-react";
import { useCallStore } from "@/stores/useCallStore";
import { useAuthStore } from "@/stores/useAuthStore";
import UserAvatar from "../chat/UserAvatar";
import { toast } from "sonner";

export const OngoingCallDialog = () => {
  const {
    callStatus,
    caller,
    receiver,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
    endCall,
    conversationId,
    initiateCall,
    resetCall,
  } = useCallStore();

  const { user: currentUser } = useAuthStore();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [showEndedScreen, setShowEndedScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef<number | null>(null);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(true);

  // Use callback refs instead of useRef for video elements
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Memoize callback refs to prevent re-setting srcObject on every render
  const setLocalVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el && localStream && callType === "video") {
      // Only set if not already set or if it's different
      if (el.srcObject !== localStream) {
        console.log('🎬 Setting local video via callback ref');
        el.srcObject = localStream;
        el.play().catch(err => console.error('Local video play error:', err));
      }
    }
    localVideoRef.current = el;
  }, [localStream, callType]);
  
  const setRemoteVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (el && remoteStream && callType === "video") {
      // Only set if not already set or if it's different
      if (el.srcObject !== remoteStream) {
        console.log('🎬 Setting remote video via callback ref');
        el.srcObject = remoteStream;
        el.play().catch(err => console.error('Remote video play error:', err));
      }
    }
    remoteVideoRef.current = el;
  }, [remoteStream, callType]);

  // Track remote video enabled state
  useEffect(() => {
    if (remoteStream && callType === "video") {
      const videoTrack = remoteStream.getVideoTracks()[0];
      if (videoTrack) {
        // Initial state
        const initialState = videoTrack.enabled && videoTrack.readyState === 'live';
        console.log('🎥 Initial remote video state:', { enabled: videoTrack.enabled, readyState: videoTrack.readyState, muted: videoTrack.muted });
        setIsRemoteVideoEnabled(initialState);
        
        // Poll for track enabled state changes (some browsers don't fire events reliably)
        const checkInterval = setInterval(() => {
          const isEnabled = videoTrack.enabled && videoTrack.readyState === 'live';
          
          // Always log current state for debugging
          console.log('🔍 Checking remote video state:', { 
            enabled: videoTrack.enabled, 
            readyState: videoTrack.readyState,
            muted: videoTrack.muted,
            isEnabled 
          });
          
          setIsRemoteVideoEnabled(isEnabled);
        }, 500);
        
        // Also listen for events
        videoTrack.onended = () => {
          console.log('❌ Remote video track ended');
          setIsRemoteVideoEnabled(false);
        };
        videoTrack.onmute = () => {
          console.log('🔇 Remote video track muted');
          setIsRemoteVideoEnabled(false);
        };
        videoTrack.onunmute = () => {
          console.log('🔊 Remote video track unmuted');
          setIsRemoteVideoEnabled(true);
        };
        
        return () => {
          clearInterval(checkInterval);
        };
      } else {
        console.log('⚠️ No remote video track found');
        setIsRemoteVideoEnabled(false);
      }
    }
  }, [remoteStream, callType]); // Removed isRemoteVideoEnabled from deps
  
  // Set up remote audio stream for audio calls
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => {
        console.error('❌ Remote audio play() failed:', err);
      });
    }
  }, [remoteStream]);

  // Track call duration
  useEffect(() => {
    if (callStatus === "connected" && !callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
      
      const interval = setInterval(() => {
        if (callStartTimeRef.current) {
          const duration = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(duration);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [callStatus]);

  // Show ended screen when call ends
  useEffect(() => {
    if (callStatus === "ended") {
      setShowEndedScreen(true);
    } else {
      setShowEndedScreen(false);
      if (callStatus !== "connected") {
        callStartTimeRef.current = null;
        setCallDuration(0);
      }
    }
  }, [callStatus]);

  const isOpen = callStatus === "calling" || callStatus === "connected" || showEndedScreen;
  const isConnected = callStatus === "connected";
  
  // Determine who is the other person
  const otherPerson = currentUser?._id === caller?._id ? receiver : caller;

  const handleCallAgain = async () => {
    if (!conversationId || !otherPerson || !callType) return;
    
    setShowEndedScreen(false);
    callStartTimeRef.current = null;
    setCallDuration(0);
    
    // Reset call state first
    resetCall();
    
    // Wait a bit for cleanup
    setTimeout(async () => {
      try {
        await initiateCall(
          conversationId,
          otherPerson._id,
          {
            _id: otherPerson._id,
            displayName: otherPerson.displayName,
            avatarUrl: otherPerson.avatarUrl,
          },
          callType
        );
      } catch (error) {
        console.error("Error calling again:", error);
        toast.error("Không thể bắt đầu cuộc gọi");
      }
    }, 500);
  };

  // Format duration as "Xm Ys"
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs} giây`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="w-full h-full">
        <span className="sr-only">Cuộc gọi đang diễn ra</span>
        <span className="sr-only">
          {callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại"} với {otherPerson?.displayName}
        </span>
        
        {/* Call Ended Screen */}
        {showEndedScreen ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-background rounded-lg p-8">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowEndedScreen(false);
                callStartTimeRef.current = null;
                setCallDuration(0);
              }}
              className="absolute top-4 right-4 rounded-full hover:bg-muted z-30"
            >
              <X className="h-6 w-6" />
            </Button>

            <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-border">
                  <UserAvatar
                    type="profile"
                    name={otherPerson?.displayName || "User"}
                    avatarUrl={otherPerson?.avatarUrl}
                  />
                </div>
              </div>

              {/* Call Info */}
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-semibold">
                  {callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến"}
                </h3>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  {callType === "video" ? (
                    <Video className="h-5 w-5 text-green-500" />
                  ) : (
                    <Phone className="h-5 w-5 text-green-500" />
                  )}
                  <span className="text-lg">{formatDuration(callDuration)}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border"></div>

              {/* Call Again Button */}
              <Button
                size="lg"
                onClick={handleCallAgain}
                className="w-full bg-primary hover:bg-primary/90 text-lg py-6"
              >
                Gọi lại
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
            {/* Remote Video (Full screen) */}
            {callType === "video" ? (
              <div 
                className="relative w-full h-full flex items-center justify-center"
                style={{ backgroundColor: 'black' }}
              >
                {/* Video element */}
                <video
                  key={`remote-${remoteStream?.id || 'video'}`}
                  ref={setRemoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                  style={{ 
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: isRemoteVideoEnabled ? 'block' : 'none',
                  }}
                />
                
                {/* Avatar fallback when video is off */}
                {!isRemoteVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 z-10">
                    <div className="text-center">
                      <div className="w-32 h-32 mx-auto mb-4">
                        <UserAvatar
                          type="profile"
                          name={otherPerson?.displayName || "User"}
                          avatarUrl={otherPerson?.avatarUrl}
                        />
                      </div>
                      <h3 className="text-2xl font-semibold text-white">
                        {otherPerson?.displayName}
                      </h3>
                      <p className="text-sm text-white/70 mt-2">Camera đã tắt</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                {/* Hidden audio element for audio calls */}
                <audio
                  ref={remoteAudioRef}
                  autoPlay
                  playsInline
                  className="hidden"
                />
                <div className="text-center">
                  <UserAvatar
                    type="profile"
                    name={otherPerson?.displayName || "User"}
                    avatarUrl={otherPerson?.avatarUrl}
                  />
                  <h3 className="text-2xl font-semibold text-white mt-4">
                    {otherPerson?.displayName}
                  </h3>
                  <p className="text-sm text-white/70 mt-2">
                    {isConnected ? "Đang gọi..." : "Đang kết nối..."}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video (Picture-in-Picture) */}
            {callType === "video" && (
              <div 
                className="absolute top-4 right-4 rounded-lg overflow-hidden shadow-lg z-20"
                style={{
                  width: '192px',
                  height: '144px',
                  border: '2px solid white',
                  backgroundColor: 'black'
                }}
              >
                {isVideoOff ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserAvatar
                      type="sidebar"
                      name={currentUser?.displayName || "You"}
                      avatarUrl={currentUser?.avatarUrl}
                    />
                  </div>
                ) : (
                  <video
                    key={`local-${localStream?.id || 'video'}`}
                    ref={setLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)',
                      display: 'block',
                    }}
                  />
                )}
              </div>
            )}

            {/* Call Status */}
            {!isConnected && (
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full z-20">
                <p className="text-sm text-white">
                  {callStatus === "calling" ? "Đang gọi..." : "Đang kết nối..."}
                </p>
              </div>
            )}

            {/* Call Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-20">
              <div className="flex items-center justify-center gap-4">
                {/* Mute Button */}
                <Button
                  size="lg"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="rounded-full w-14 h-14"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>

                {/* End Call Button */}
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-16 h-16"
                  onClick={endCall}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>

                {/* Video Toggle Button */}
                {callType === "video" && (
                  <Button
                    size="lg"
                    variant={isVideoOff ? "destructive" : "secondary"}
                    className="rounded-full w-14 h-14"
                    onClick={toggleVideo}
                  >
                    {isVideoOff ? (
                      <VideoOff className="h-6 w-6" />
                    ) : (
                      <Video className="h-6 w-6" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
