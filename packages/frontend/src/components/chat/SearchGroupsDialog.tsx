import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Search, Users } from "lucide-react";
import { conversationService } from "@/services/conversationService";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import GroupChatAvatar from "./GroupChatAvatar";

interface SearchGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GroupSearchResult {
  _id: string;
  name: string;
  avatar?: string;
  description?: string;
  createdBy: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  participantCount: number;
  isParticipant: boolean;
  createdAt: string;
}

export function SearchGroupsDialog({ open, onOpenChange }: SearchGroupsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<GroupSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const { fetchConversations, setActiveConversation } = useChatStore();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setGroups([]);
      return;
    }

    setSearching(true);
    try {
      const response = await conversationService.searchGroups(searchQuery);
      setGroups(response.groups || []);
    } catch (error) {
      console.error("Error searching groups:", error);
      toast.error("Không thể tìm kiếm nhóm");
    } finally {
      setSearching(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    setLoading(true);
    try {
      const response = await conversationService.rejoinGroup(groupId);
      toast.success("Đã tham gia nhóm");
      
      // Refresh conversations and open the group
      await fetchConversations();
      setActiveConversation(groupId);
      
      // Close dialog
      onOpenChange(false);
      
      // Reset search
      setSearchQuery("");
      setGroups([]);
    } catch (error: any) {
      console.error("Error joining group:", error);
      toast.error(error.response?.data?.message || "Không thể tham gia nhóm");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tìm kiếm nhóm</DialogTitle>
          <DialogDescription>
            Tìm và tham gia các nhóm chat
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Nhập tên nhóm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Results */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {groups.length === 0 && searchQuery && !searching && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Không tìm thấy nhóm nào
              </p>
            )}

            {groups.length === 0 && !searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nhập tên nhóm để tìm kiếm
              </p>
            )}

            {searching && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Đang tìm kiếm...
              </p>
            )}

            {groups.map((group) => (
              <div
                key={group._id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.participantCount} thành viên
                    </p>
                    {group.description && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                {group.isParticipant ? (
                  <Button variant="outline" size="sm" disabled>
                    Đã tham gia
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleJoinGroup(group._id)}
                    size="sm"
                    disabled={loading}
                  >
                    Tham gia
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
