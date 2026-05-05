import { useChatStore } from "@/stores/useChatStore";
import DirectMessageCard from "./DirectMessageCard";
import { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Search, RotateCcw } from "lucide-react";
import { conversationService } from "@/services/conversationService";
import { toast } from "sonner";
import { Button } from "../ui/button";
import UserAvatar from "./UserAvatar";

interface SearchResult {
  _id: string;
  type: string;
  user?: any;
  participants: any[];
  lastMessage?: any;
  isHidden: boolean;
  leftAt?: string;
}

const DirectMessageList = () => {
  const { conversations, fetchConversations, setActiveConversation } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Search when query changes
  useEffect(() => {
    const searchConversations = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await conversationService.searchConversations(searchQuery);
        const directResults = response.conversations.filter((c: SearchResult) => c.type === 'direct');
        setSearchResults(directResults);
      } catch (error) {
        console.error("Error searching conversations:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchConversations, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Early return after all hooks
  if (!conversations) return null;

  const directConversations = (conversations || []).filter(
    (convo) => convo.type === "direct"
  );

  const handleRestore = async (conversationId: string) => {
    setRestoring(conversationId);
    try {
      await conversationService.restoreConversation(conversationId);
      toast.success("Đã khôi phục cuộc trò chuyện");
      
      // Refresh conversations and open the restored conversation
      await fetchConversations();
      setActiveConversation(conversationId);
      
      // Clear search
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      console.error("Error restoring conversation:", error);
      toast.error(error.response?.data?.message || "Không thể khôi phục cuộc trò chuyện");
    } finally {
      setRestoring(null);
    }
  };

  const filteredConversations = directConversations.filter((convo) => {
    if (!searchQuery) return true;
    
    const otherUser = convo.user;
    if (!otherUser) return false;

    const query = searchQuery.toLowerCase();
    return (
      otherUser.displayName?.toLowerCase().includes(query) ||
      otherUser.username?.toLowerCase().includes(query)
    );
  });

  // Show search results if searching
  const displayResults = searchQuery ? searchResults : [];
  const hiddenResults = displayResults.filter(r => r.isHidden);
  const activeResults = displayResults.filter(r => !r.isHidden);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm bạn bè..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-light border-border/30 pl-10"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {searchQuery ? (
          <>
            {/* Active conversations from search */}
            {activeResults.length > 0 && (
              <div className="space-y-2">
                {activeResults.map((result) => {
                  const convo = conversations.find(c => c._id === result._id);
                  if (convo) {
                    return <DirectMessageCard convo={convo} key={convo._id} />;
                  }
                  return null;
                })}
              </div>
            )}

            {/* Hidden/Deleted conversations */}
            {hiddenResults.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground px-2 py-1">
                  Cuộc trò chuyện đã xóa
                </div>
                {hiddenResults.map((result) => (
                  <div
                    key={result._id}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <UserAvatar
                      type="sidebar"
                      name={result.user?.displayName || "User"}
                      avatarUrl={result.user?.avatarUrl}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {result.user?.displayName || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.lastMessage?.content || "Không có tin nhắn"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRestore(result._id)}
                      disabled={restoring === result._id}
                      className="shrink-0"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {isSearching && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Đang tìm kiếm...
              </div>
            )}

            {!isSearching && displayResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Không tìm thấy cuộc trò chuyện
              </div>
            )}
          </>
        ) : (
          <>
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Chưa có cuộc trò chuyện nào
              </div>
            ) : (
              filteredConversations.map((convo) => (
                <DirectMessageCard
                  convo={convo}
                  key={convo._id}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DirectMessageList;

