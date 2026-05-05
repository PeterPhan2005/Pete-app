import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";

const ProtectedRoute = () => {
  const { accessToken, user, loading, refresh, fetchMe } = useAuthStore();
  const [starting, setStarting] = useState(true);

  const init = async () => {
    const { accessToken: currentAccessToken, user: currentUser } =
      useAuthStore.getState();

    // Chỉ thử refresh nếu trước đó đã có trạng thái đăng nhập được lưu lại.
    if (!currentAccessToken && !currentUser) {
      setStarting(false);
      return;
    }

    if (!currentAccessToken) {
      await refresh();
    }

    const { accessToken: nextAccessToken, user: nextUser } =
      useAuthStore.getState();

    if (nextAccessToken && !nextUser) {
      await fetchMe();
    }

    setStarting(false);
  };

  useEffect(() => {
    init();
  }, []);

  if (starting || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Đang tải trang...
      </div>
    );
  }

  if (!accessToken) {
    return (
      <Navigate
        to="/signin"
        replace
      />
    );
  }

  return <Outlet></Outlet>;
};

export default ProtectedRoute;
