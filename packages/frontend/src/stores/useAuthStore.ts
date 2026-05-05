import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      setUser: (user) => {
        set({ user });
      },
      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        useChatStore.getState().reset();
        localStorage.clear();
        sessionStorage.clear();
      },
      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });

          //  gọi api
          await authService.signUp(username, password, email, firstName, lastName);

          toast.success(
            "Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập."
          );
        } catch (error: any) {
          console.error(error);
          const errorMessage = error.response?.data?.message || "Đăng ký không thành công";
          toast.error(errorMessage);
          throw error;
        } finally {
          set({ loading: false });
        }
      },
      signIn: async (username, password) => {
        try {
          get().clearState();
          set({ loading: true });

          const { accessToken } = await authService.signIn(username, password);
          get().setAccessToken(accessToken);

          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại với Callapp🎉");
        } catch (error: any) {
          console.error(error);
          const errorMessage = error.response?.data?.message || "Đăng nhập không thành công!";
          toast.error(errorMessage);
          throw error; // Re-throw to prevent navigation
        } finally {
          set({ loading: false });
        }
      },
      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error: any) {
          console.error(error);
          const errorMessage = error.response?.data?.message || "Lỗi xảy ra khi logout. Hãy thử lại!";
          toast.error(errorMessage);
        }
      },
      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();

          set({ user });
        } catch (error: any) {
          console.error(error);
          set({ user: null, accessToken: null });
          const errorMessage = error.response?.data?.message || "Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!";
          toast.error(errorMessage);
        } finally {
          set({ loading: false });
        }
      },
      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error: any) {
          console.error(error);
          const errorMessage = error.response?.data?.message || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!";

          if (error.response?.data?.message !== "Refresh token không tồn tại") {
            toast.error(errorMessage);
          }

          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }), // chỉ persist user
    }
  )
);
