import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatStore } from "@/stores/useChatStore";
import type { Conversation } from "@/types/chat";
import { Bell, Settings, Shield, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface ConversationSettingsProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationSettings({
  conversation,
  isOpen,
  onClose,
}: ConversationSettingsProps) {
  const { updateGroupSettings, updateGroupInfo, updateNotificationSettings } = useChatStore();
  const [groupName, setGroupName] = useState(conversation.group?.name || "");
  const [groupDescription, setGroupDescription] = useState(
    conversation.group?.description || ""
  );

  const isGroup = conversation.type === "group";
  const settings = conversation.settings;

  const handleUpdateGroupInfo = async () => {
    try {
      await updateGroupInfo(conversation._id, {
        groupName,
        groupDescription,
      });
      toast.success("Đã cập nhật thông tin nhóm");
    } catch (error) {
      toast.error("Không thể cập nhật");
    }
  };

  const handleTogglePermission = async (
    key: "onlyAdminsCanSend" | "onlyAdminsCanEditGroup" | "allowMembersToInvite",
    value: boolean
  ) => {
    try {
      await updateGroupSettings(conversation._id, { [key]: value });
      toast.success("Đã cập nhật quyền");
    } catch (error) {
      toast.error("Không thể cập nhật");
    }
  };

  const handleToggleNotification = async (key: string, value: boolean) => {
    try {
      await updateNotificationSettings(conversation._id, { [key]: value });
      toast.success("Đã cập nhật thông báo");
    } catch (error) {
      toast.error("Không thể cập nhật");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cài đặt {isGroup ? "nhóm" : "cuộc trò chuyện"}
          </DialogTitle>
          <DialogDescription>
            Quản lý thông tin và quyền của {isGroup ? "nhóm" : "cuộc trò chuyện"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">
              <Users className="h-4 w-4 mr-2" />
              Thông tin
            </TabsTrigger>
            {isGroup && (
              <TabsTrigger value="permissions">
                <Shield className="h-4 w-4 mr-2" />
                Quyền
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Thông báo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            {isGroup && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="groupName">Tên nhóm</Label>
                  <Input
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupDescription">Mô tả</Label>
                  <Input
                    id="groupDescription"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="Nhập mô tả nhóm"
                  />
                </div>
                <Button onClick={handleUpdateGroupInfo}>Lưu thông tin</Button>
              </>
            )}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Số thành viên: {conversation.participants.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Tạo lúc: {new Date(conversation.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>
          </TabsContent>

          {isGroup && (
            <TabsContent value="permissions" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Chỉ admin gửi tin nhắn</Label>
                  <p className="text-sm text-muted-foreground">
                    Chỉ admin mới có thể gửi tin nhắn trong nhóm
                  </p>
                </div>
                <Switch
                  checked={settings?.onlyAdminsCanSend}
                  onCheckedChange={(checked) =>
                    handleTogglePermission("onlyAdminsCanSend", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Chỉ admin chỉnh sửa nhóm</Label>
                  <p className="text-sm text-muted-foreground">
                    Chỉ admin mới có thể chỉnh sửa thông tin nhóm
                  </p>
                </div>
                <Switch
                  checked={settings?.onlyAdminsCanEditGroup}
                  onCheckedChange={(checked) =>
                    handleTogglePermission("onlyAdminsCanEditGroup", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cho phép thành viên mời người</Label>
                  <p className="text-sm text-muted-foreground">
                    Thành viên có thể thêm người khác vào nhóm
                  </p>
                </div>
                <Switch
                  checked={settings?.allowMembersToInvite}
                  onCheckedChange={(checked) =>
                    handleTogglePermission("allowMembersToInvite", checked)
                  }
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bật thông báo</Label>
                <p className="text-sm text-muted-foreground">
                  Nhận thông báo từ cuộc trò chuyện này
                </p>
              </div>
              <Switch
                defaultChecked
                onCheckedChange={(checked) => handleToggleNotification("enabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Thông báo khi được nhắc</Label>
                <p className="text-sm text-muted-foreground">
                  Nhận thông báo khi ai đó @mention bạn
                </p>
              </div>
              <Switch
                defaultChecked
                onCheckedChange={(checked) => handleToggleNotification("mentions", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Thông báo khi được trả lời</Label>
                <p className="text-sm text-muted-foreground">
                  Nhận thông báo khi có người trả lời tin nhắn của bạn
                </p>
              </div>
              <Switch
                defaultChecked
                onCheckedChange={(checked) => handleToggleNotification("replies", checked)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
