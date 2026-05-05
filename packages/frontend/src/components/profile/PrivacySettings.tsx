import { Shield, ShieldBan } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import ChangePasswordDialog from "./ChangePasswordDialog";
import BlockedUsersDialog from "./BlockedUsersDialog";
import DeleteAccountDialog from "./DeleteAccountDialog";

const PrivacySettings = () => {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  return (
    <>
      <Card className="glass-strong border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quyền riêng tư & Bảo mật
          </CardTitle>
          <CardDescription>
            Quản lý cài đặt quyền riêng tư và bảo mật của bạn
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-warning"
              onClick={() => setShowChangePassword(true)}
            >
              <Shield className="h-4 w-4 mr-2" />
              Đổi mật khẩu
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start glass-light border-border/30 hover:text-destructive"
              onClick={() => setShowBlockedUsers(true)}
            >
              <ShieldBan className="size-4 mr-2" />
              Chặn & Báo cáo
            </Button>
          </div>

          <div className="pt-4 border-t border-border/30">
            <h4 className="font-medium mb-3 text-destructive">Khu vực nguy hiểm</h4>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDeleteAccount(true)}
            >
              Xoá tài khoản
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
      <BlockedUsersDialog
        open={showBlockedUsers}
        onOpenChange={setShowBlockedUsers}
      />
      <DeleteAccountDialog
        open={showDeleteAccount}
        onOpenChange={setShowDeleteAccount}
      />
    </>
  );
};

export default PrivacySettings;
