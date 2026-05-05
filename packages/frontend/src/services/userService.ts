import api from "@/lib/axios";

export const userService = {
  uploadAvatar: async (formData: FormData) => {
    const res = await api.post("/user/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  updateProfile: async (data: { displayName?: string; phone?: string; bio?: string }) => {
    const res = await api.put("/user/profile", data);
    return res.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    const res = await api.put("/user/change-password", data);
    return res.data;
  },

  deleteAccount: async (password: string) => {
    const res = await api.delete("/user/account", { data: { password } });
    return res.data;
  },
};
