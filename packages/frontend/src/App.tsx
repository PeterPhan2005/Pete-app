import { BrowserRouter, Route, Routes } from "react-router";
import SignInPage from "./pages/SignInPage";
import ChatAppPage from "./pages/ChatAppPage";
import { Toaster } from "sonner";
import SignUpPage from "./pages/SignUpPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useThemeStore } from "./stores/useThemeStore";
import { useEffect } from "react";
import { useAuthStore } from "./stores/useAuthStore";
import { useSocketStore } from "./stores/useSocketStore";
import { useFriendStore } from "./stores/useFriendStore";
import { useChatStore } from "./stores/useChatStore";
import { conversationService } from "./services/conversationService";
import { IncomingCallDialog } from "./components/call/IncomingCallDialog";
import { OngoingCallDialog } from "./components/call/OngoingCallDialog";

function App() {
  const { isDark, setTheme } = useThemeStore();
  const { accessToken } = useAuthStore();
  const { connectSocket, disconnectSocket } = useSocketStore();
  const { getAllFriendRequests, getFriends } = useFriendStore();
  const { fetchConversations } = useChatStore();

  useEffect(() => {
    setTheme(isDark);
  }, [isDark]);

  useEffect(() => {
    if (accessToken) {
      connectSocket();
      getAllFriendRequests(); // Load friend requests on login
      getFriends(); // Load friends list on login
      fetchConversations(); // Always fetch fresh conversations from DB (not localStorage)

      // Clean up duplicate conversations
      conversationService.cleanupDuplicates().catch(err => {
        console.error("Failed to cleanup duplicates:", err);
      });
    }

    return () => disconnectSocket();
  }, [accessToken]);

  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Routes>
          {/* public routes */}
          <Route
            path="/signin"
            element={<SignInPage />}
          />
          <Route
            path="/signup"
            element={<SignUpPage />}
          />

          {/* protectect routes */}
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={<ChatAppPage />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
      
      {/* Call Dialogs - Global */}
      <IncomingCallDialog />
      <OngoingCallDialog />
    </>
  );
}

export default App;
