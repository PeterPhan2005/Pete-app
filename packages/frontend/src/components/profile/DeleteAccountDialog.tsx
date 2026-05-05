import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { userService } from "@/services/userService";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useNavigate } from "react-router-dom";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { clearState } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Vui lòng nhập mật khẩu");
      return;
    }

    setIsLoading(true);

    try {
      await userService.deleteAccount(password);
      toast.success("Tài khoản đã được xóa thành công");
      clearState();
      navigate("/signin");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-destructive/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Xóa tài khoản
          </DialogTitle>
          <DialogDescription className="text-destructive/80">
            Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa vĩnh viễn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Cảnh báo:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Tất cả tin nhắn của bạn sẽ bị xóa</li>
              <li>Tất cả cuộc hội thoại sẽ bị xóa</li>
              <li>Danh sách bạn bè sẽ bị xóa</li>
              <li>Không thể khôi phục tài khoản sau khi xóa</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nhập mật khẩu để xác nhận</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-light border-border/30"
              placeholder="Mật khẩu của bạn"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="glass-light border-border/30"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? "Đang xử lý..." : "Xóa tài khoản"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
