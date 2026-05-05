import { create } from "zustand";
import { useSocketStore } from "./useSocketStore";
import { useAuthStore } from "./useAuthStore";

interface CallState {
  // Call state
  callId: string | null;
  roomId: string | null;
  conversationId: string | null;
  callType: "audio" | "video" | null;
  callStatus: "idle" | "calling" | "ringing" | "connected" | "ended";
  
  // Caller/Receiver info
  caller: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  receiver: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  
  // Media streams
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Peer connection
  peerConnection: RTCPeerConnection | null;
  
  // Controls
  isMuted: boolean;
  isVideoOff: boolean;
  
  // Actions
  initiateCall: (conversationId: string, receiverId: string, receiverInfo: any, callType: "audio" | "video") => Promise<void>;
  acceptCall: (callId: string, roomId: string, caller: any) => Promise<void>;
  declineCall: (callId: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setRemoteStream: (stream: MediaStream) => void;
  resetCall: () => void;
}

// ICE servers configuration — includes STUN + TURN for NAT traversal
// Note: coturn uses network_mode=host, bind on 0.0.0.0:3478 on VM's external IP 34.31.6.176
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Primary TURN: VM's coturn on peterphan.online (NAT traversal for cross-network calls)
    {
      urls: 'turn:34.31.6.176:3478?transport=udp',
      username: 'pete',
      credential: 'pete_turn_secret_2024',
    },
    // Fallback TURN: same server via TCP
    {
      urls: 'turn:34.31.6.176:3478?transport=tcp',
      username: 'pete',
      credential: 'pete_turn_secret_2024',
    },
    // Domain-based TURN (if DNS resolves correctly)
    {
      urls: 'turn:peterphan.online:3478?transport=udp',
      username: 'pete',
      credential: 'pete_turn_secret_2024',
    },
  ]
};

export const useCallStore = create<CallState>((set, get) => ({
  // Initial state
  callId: null,
  roomId: null,
  conversationId: null,
  callType: null,
  callStatus: "idle",
  caller: null,
  receiver: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  isVideoOff: false,

  // Initiate call (caller side)
  initiateCall: async (conversationId, receiverId, receiverInfo, callType) => {
    try {
      const socket = useSocketStore.getState().socket;
      const currentUser = useAuthStore.getState().user;
      
      if (!socket || !currentUser) {
        throw new Error("Socket or user not available");
      }

      // Get local media stream with specific constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: callType === "video" ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('🎥 Got local stream:', stream.getTracks().map(t => {
        const track = stream.getTracks().find(tr => tr.kind === t.kind);
        if (track && track.kind === 'video') {
          const settings = track.getSettings();
          return `${t.kind}: ${t.enabled}, ${settings.width}x${settings.height}`;
        }
        return `${t.kind}: ${t.enabled}`;
      }));

      set({
        localStream: stream,
        conversationId,
        callType,
        callStatus: "calling",
        receiver: receiverInfo,
        caller: {
          _id: currentUser._id,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
        },
      });

      // Create peer connection
      const pc = new RTCPeerConnection(iceServers);
      set({ peerConnection: pc });

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('➕ Adding track to peer connection:', track.kind);
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: receiverId,
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📥 Received remote track:', event.track.kind);
        console.log('📥 Remote streams:', event.streams);
        if (event.streams && event.streams[0]) {
          console.log('✅ Setting remote stream');
          const remoteStream = event.streams[0];
          console.log('Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
          set({ remoteStream, callStatus: "connected" });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          get().endCall();
        }
      };

      // Setup socket listeners BEFORE emitting events
      console.log('🔧 Setting up WebRTC socket listeners...');
      
      // Listen for answer
      socket.on("webrtc:answer", async ({ answer }) => {
        console.log('📥 Received answer');
        const { peerConnection } = get();
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description set');
        } else {
          console.error('❌ Cannot set remote description, peer connection state:', peerConnection?.signalingState);
        }
      });

      // Listen for ICE candidates
      socket.on("webrtc:ice-candidate", async ({ candidate }) => {
        const { peerConnection } = get();
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
      });

      // Listen for call initiated confirmation
      socket.once("call:initiated", async ({ callId, roomId }) => {
        console.log('📞 Call initiated, waiting for acceptance...');
        set({ callId, roomId });
      });

      // Listen for call accepted - create and send WebRTC offer
      socket.once("call:accepted", async () => {
        console.log('✅ Call accepted, creating offer...');
        set({ callStatus: "connected" });

        const { peerConnection, callId: currentCallId } = get();
        if (peerConnection) {
          // Create and send offer
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log('📤 Sending offer to:', receiverId);

          socket.emit("webrtc:offer", {
            callId: currentCallId,
            offer,
            to: receiverId,
          });
        }
      });

      // Listen for call declined
      socket.once("call:declined", () => {
        get().endCall();
      });

      // NOW emit call initiate event (after all listeners are setup)
      socket.emit("call:initiate", {
        conversationId,
        callType,
        callerId: currentUser._id,
        receiverId,
      });

    } catch (error) {
      console.error("Error initiating call:", error);
      get().resetCall();
      throw error;
    }
  },

  // Accept call (receiver side)
  acceptCall: async (callId, roomId, caller) => {
    try {
      const socket = useSocketStore.getState().socket;
      const currentUser = useAuthStore.getState().user;
      
      if (!socket || !currentUser) {
        throw new Error("Socket or user not available");
      }

      const { callType } = get();

      // Get local media stream with specific constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: callType === "video" ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } : false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('🎥 Got local stream (acceptCall):', stream.getTracks().map(t => {
        const track = stream.getTracks().find(tr => tr.kind === t.kind);
        if (track && track.kind === 'video') {
          const settings = track.getSettings();
          return `${t.kind}: ${t.enabled}, ${settings.width}x${settings.height}`;
        }
        return `${t.kind}: ${t.enabled}`;
      }));

      set({
        localStream: stream,
        callId,
        roomId,
        callStatus: "connected",
        caller,
        receiver: {
          _id: currentUser._id,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
        },
      });

      // Create peer connection
      const pc = new RTCPeerConnection(iceServers);
      set({ peerConnection: pc });

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        console.log('➕ Adding track to peer connection (acceptCall):', track.kind);
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: caller._id,
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('📥 Received remote track (acceptCall):', event.track.kind);
        console.log('📥 Remote streams:', event.streams);
        if (event.streams && event.streams[0]) {
          console.log('✅ Setting remote stream (acceptCall)');
          const remoteStream = event.streams[0];
          console.log('Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
          set({ remoteStream });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          get().endCall();
        }
      };

      // Setup socket listeners BEFORE emitting events
      console.log('🔧 Setting up WebRTC socket listeners (acceptCall)...');
      
      // Listen for offer
      socket.once("webrtc:offer", async ({ offer, from }) => {
        console.log('📥 Received offer from:', from);
        const { peerConnection } = get();
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          console.log('✅ Remote description set, creating answer...');
          
          // Create and send answer
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          console.log('📤 Sending answer to:', from);
          
          socket.emit("webrtc:answer", {
            callId,
            answer,
            to: from,
          });
        } else {
          console.error('❌ Cannot set remote description, peer connection state:', peerConnection?.signalingState);
        }
      });

      // Listen for ICE candidates
      socket.on("webrtc:ice-candidate", async ({ candidate }) => {
        const { peerConnection } = get();
        if (peerConnection && peerConnection.signalingState !== 'closed') {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
      });

      // NOW emit call accept event (after all listeners are setup)
      socket.emit("call:accept", {
        callId,
        userId: currentUser._id,
      });

    } catch (error) {
      console.error("Error accepting call:", error);
      get().resetCall();
      throw error;
    }
  },

  // Decline call
  declineCall: (callId) => {
    const socket = useSocketStore.getState().socket;
    const currentUser = useAuthStore.getState().user;
    
    if (socket && currentUser) {
      socket.emit("call:decline", {
        callId,
        userId: currentUser._id,
      });
    }
    
    get().resetCall();
  },

  // End call
  endCall: () => {
    const { callId, localStream, peerConnection } = get();
    const socket = useSocketStore.getState().socket;
    const currentUser = useAuthStore.getState().user;

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    // Remove socket listeners to prevent memory leaks
    if (socket) {
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("call:accepted");
      socket.off("call:declined");
    }

    // Emit end call event
    if (socket && currentUser && callId) {
      socket.emit("call:end", {
        callId,
        userId: currentUser._id,
      });
    }

    // Set status to ended instead of resetting immediately
    set({ callStatus: "ended" });
  },

  // Toggle mute
  toggleMute: () => {
    const { localStream, isMuted } = get();
    
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle
      });
      set({ isMuted: !isMuted });
    }
  },

  // Toggle video
  toggleVideo: () => {
    const { localStream, isVideoOff } = get();
    
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff; // Toggle
      });
      set({ isVideoOff: !isVideoOff });
    }
  },

  // Set remote stream
  setRemoteStream: (stream) => {
    set({ remoteStream: stream });
  },

  // Reset call state
  resetCall: () => {
    const { localStream, peerConnection } = get();
    const socket = useSocketStore.getState().socket;
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnection) {
      peerConnection.close();
    }

    // Remove socket listeners
    if (socket) {
      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice-candidate");
      socket.off("call:accepted");
      socket.off("call:declined");
    }

    set({
      callId: null,
      roomId: null,
      conversationId: null,
      callType: null,
      callStatus: "idle",
      caller: null,
      receiver: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isVideoOff: false,
    });
  },
}));
