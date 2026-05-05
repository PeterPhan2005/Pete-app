import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useChatStore } from "@/stores/useChatStore";
import type { Message } from "@/types/chat";
import { formatMessageTime } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

interface SearchMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

const SearchMessagesDialog = ({ open, onOpenChange, conversationId }: SearchMessagesDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { searchMessages } = useChatStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchMessages(conversationId, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching messages:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30 max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tìm kiếm tin nhắn</DialogTitle>
          <DialogDescription>
            Tìm kiếm tin nhắn trong cuộc trò chuyện này
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nhập từ khóa tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-light border-border/30 pl-10"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-gradient-primary"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tìm...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Tìm kiếm
              </>
            )}
          </Button>
        </form>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-4">
          {searchResults.length === 0 && !isSearching && searchQuery && (
            <div className="text-center py-8 text-muted-foreground">
              Không tìm thấy tin nhắn nào
            </div>
          )}

          {searchResults.map((message) => {
            const senderName = message.sender?.displayName || message.senderId?.displayName || "Unknown";
            const senderAvatar = message.sender?.avatarUrl || message.senderId?.avatarUrl;
            
            return (
              <div
                key={message._id}
                className="p-3 glass-light rounded-lg border border-border/30 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    type="chat"
                    name={senderName}
                    avatarUrl={senderAvatar}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {senderName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(new Date(message.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm text-foreground break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchMessagesDialog;
