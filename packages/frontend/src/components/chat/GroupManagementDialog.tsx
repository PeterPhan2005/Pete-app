import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation } from "@/types/chat";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  UserPlus, 
  Shield, 
  ShieldOff, 
  Edit, 
  Trash2, 
  LogOut,
  MessageSquareOff
} from "lucide-react";
import UserAvatar from "./UserAvatar";
import { useFriendStore } from "@/stores/useFriendStore";

interface GroupManagementDialogProps {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupManagementDialog({
  conversation,
  isOpen,
  onClose,
}: GroupManagementDialogProps) {
  // 1. Khai báo TẤT CẢ các Hook TRƯỚC
  const { user } = useAuthStore();
  const { friends, getFriends } = useFriendStore();
  const {
    conversations,
    updateGroupInfo,
    updateGroupSettings,
    addParticipantToGroup,
    removeParticipantFromGroup,
    addAdminToGroup,
    removeAdminFromGroup,
    deleteConversation,
    disbandGroup,
    leaveConversation,
    fetchConversations,
  } = useChatStore();

  const [groupName, setGroupName] = useState(conversation.group?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh conversation data when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen]);

  // Close dialog if conversation no longer exists (user was removed)
  useEffect(() => {
    if (isOpen && conversation) {
      const exists = conversations?.find((c: any) => c._id === conversation._id);
      if (!exists) {
        onClose();
      }
    }
  }, [isOpen, conversation._id, conversations?.length]);

  // 2. Kiểm tra điều kiện render SAU khi đã khai báo tất cả Hook
  if (!user) return null;

  // Determine user role - Creator is always considered admin
  const createdById = typeof conversation.createdBy === 'string' 
    ? conversation.createdBy 
    : (conversation.createdBy as any)?._id;
  
  const isCreator = createdById?.toString() === user._id;
  const isAdmin = isCreator || conversation.admins?.some((admin: any) => {
    const adminId = typeof admin === 'string' ? admin : (admin as any)._id;
    return adminId?.toString() === user._id;
  });
  const isMember = !isCreator && !isAdmin;

  const handleUpdateName = async () => {
    if (!groupName.trim()) {
      toast.error("Tên nhóm không được để trống");
      return;
    }
    try {
      await updateGroupInfo(conversation._id, { groupName });
      setIsEditingName(false);
      toast.success("Đã cập nhật tên nhóm");
    } catch (error) {
      toast.error("Không thể cập nhật tên nhóm");
    }
  };


  const handleAddMember = async (friendId: string) => {
    try {
      await addParticipantToGroup(conversation._id, friendId);
      toast.success("Đã thêm thành viên");
      setIsAddingMember(false);
      setSearchQuery("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể thêm thành viên");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeParticipantFromGroup(conversation._id, userId);
      toast.success("Đã xóa thành viên");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể xóa thành viên");
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    try {
      await addAdminToGroup(conversation._id, userId);
      toast.success("Đã bổ nhiệm admin");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể bổ nhiệm admin");
    }
  };

  const handleDemoteAdmin = async (userId: string) => {
    try {
      await removeAdminFromGroup(conversation._id, userId);
      toast.success("Đã xóa quyền admin");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể xóa quyền admin");
    }
  };

  const handleToggleAdminOnly = async () => {
    try {
      const newValue = !conversation.settings?.onlyAdminsCanSend;
      await updateGroupSettings(conversation._id, { onlyAdminsCanSend: newValue });
      toast.success(newValue ? "Đã bật chế độ chỉ admin chat" : "Đã tắt chế độ chỉ admin chat");
    } catch (error) {
      toast.error("Không thể cập nhật cài đặt");
    }
  };

  const handleDisbandGroup = async () => {
    try {
      await disbandGroup(conversation._id);
      toast.success("Đã giải tán nhóm");
      onClose();
    } catch (error) {
      toast.error("Không thể giải tán nhóm");
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await leaveConversation(conversation._id);
      toast.success("Đã rời khỏi nhóm");
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể rời nhóm");
    }
  };

  // Get friends not in group
  const availableFriends = friends
    .map(f => f.friendId)
    .filter(friend => {
      if (!friend) return false;
      const isInGroup = conversation.participants?.some((p: any) => {
        const pId = typeof p === 'string' ? p : p._id;
        return pId?.toString() === friend._id?.toString();
      });
      const matchesSearch = friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
      return !isInGroup && matchesSearch;
    });

  // Check permissions
  const canEditName = isCreator || isAdmin;
  const canToggleAdminChat = isCreator || isAdmin;
  const canAddMember = true; // All members can add based on settings
  const canPromoteDemote = isCreator;
  const canRemoveMember = isCreator || isAdmin;
  const canDeleteGroup = isCreator;
  const canLeaveGroup = !isCreator; // Creator cannot leave

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Quản lý nhóm</DialogTitle>
          <DialogDescription>
            Quản lý thành viên, quyền admin và cài đặt nhóm
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Edit Group Name - Creator & Admin */}
          {canEditName && (
            <div className="space-y-2">
              <Label>Tên nhóm</Label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nhập tên nhóm"
                  />
                  <Button onClick={handleUpdateName} size="sm">
                    Lưu
                  </Button>
                  <Button onClick={() => setIsEditingName(false)} variant="outline" size="sm">
                    Hủy
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>{conversation.group?.name}</span>
                  <Button onClick={() => setIsEditingName(true)} variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Admin Only Chat - Creator & Admin */}
          {canToggleAdminChat && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquareOff className="h-4 w-4" />
                <span>Chỉ admin được chat</span>
              </div>
              <Button onClick={handleToggleAdminOnly} variant="outline" size="sm">
                {conversation.settings?.onlyAdminsCanSend ? "Tắt" : "Bật"}
              </Button>
            </div>
          )}

          {/* Add Member - All can add based on settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Thành viên ({conversation.participants?.length || 0})</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setIsAddingMember(!isAddingMember);
                    if (!isAddingMember) getFriends();
                  }} 
                  variant="outline" 
                  size="sm"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
                
                {/* Delete Group - Creator only */}
                {canDeleteGroup && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Bạn có chắc muốn giải tán nhóm? Hành động này không thể hoàn tác.")) {
                        handleDisbandGroup();
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Giải tán nhóm
                  </Button>
                )}

                {/* Leave Group - Admin & Member */}
                {canLeaveGroup && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Bạn có chắc muốn rời khỏi nhóm?")) {
                        handleLeaveGroup();
                      }
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Rời nhóm
                  </Button>
                )}
              </div>
            </div>

            {isAddingMember && (
              <div className="space-y-2 p-3 border rounded-lg">
                <Input
                  placeholder="Tìm bạn bè..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {availableFriends.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Không tìm thấy bạn bè
                    </p>
                  ) : (
                    availableFriends.map((friend) => (
                      <div key={friend._id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            type="chat"
                            name={friend.displayName}
                            avatarUrl={friend.avatarUrl}
                          />
                          <span className="text-sm">{friend.displayName}</span>
                        </div>
                        <Button onClick={() => handleAddMember(friend._id)} size="sm">
                          Thêm
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Member List */}
            <div className="space-y-2">
              {conversation.participants?.map((participant: any) => {
                const pData = typeof participant === 'string' ? null : participant;
                const pId = typeof participant === 'string' ? participant : (participant as any)._id;
                
                // Fix: Handle createdBy as object or string
                const participantCreatorId = typeof conversation.createdBy === 'string' 
                  ? conversation.createdBy 
                  : (conversation.createdBy as any)?._id;
                const isParticipantCreator = participantCreatorId?.toString() === pId?.toString();
                
                const isParticipantAdmin = conversation.admins?.some((admin: any) => {
                  const adminId = typeof admin === 'string' ? admin : (admin as any)._id;
                  return adminId?.toString() === pId?.toString();
                });
                const isCurrentUser = pId?.toString() === user._id;

                // Determine which buttons to show
                const showPromoteDemote = !isCurrentUser && canPromoteDemote && !isParticipantCreator;
                const showRemove = !isCurrentUser && canRemoveMember && !isParticipantCreator;

                return (
                  <div key={pId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <UserAvatar
                        type="chat"
                        name={pData?.displayName || "User"}
                        avatarUrl={pData?.avatarUrl}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {pData?.displayName || "User"}
                          {isCurrentUser && " (Bạn)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isParticipantCreator ? "Trưởng nhóm" : isParticipantAdmin ? "Admin" : "Thành viên"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Promote/Demote Admin - Only for creator */}
                      {showPromoteDemote && (
                        isParticipantAdmin ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-amber-600 hover:text-amber-600 hover:bg-amber-600/10"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa quyền admin của ${pData?.displayName}?`)) {
                                handleDemoteAdmin(pId);
                              }
                            }}
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-600 hover:bg-blue-600/10"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn bổ nhiệm ${pData?.displayName} làm admin?`)) {
                                handlePromoteToAdmin(pId);
                              }
                            }}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        )
                      )}

                      {/* Remove Member - Show trash icon for admin/owner, but not for creator and not for self */}
                      {showRemove && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc muốn xóa ${pData?.displayName} khỏi nhóm?`)) {
                              handleRemoveMember(pId);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
