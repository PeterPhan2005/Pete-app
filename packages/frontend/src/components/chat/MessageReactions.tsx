import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Reaction } from "@/types/chat";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface MessageReactionsProps {
  messageId: string;
  reactions?: Reaction[];
}

export function MessageReactions({ messageId, reactions = [] }: MessageReactionsProps) {
  const { addReaction, removeReaction } = useChatStore();
  const { user } = useAuthStore();

  if (!reactions || reactions.length === 0) return null;

  const handleReactionClick = async (emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    } catch (error) {
      toast.error("Không thể thực hiện");
    }
  };

  const handleAddReaction = () => {
    // TODO: Open emoji picker
    toast.info("Emoji picker đang được phát triển");
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction) => {
        const hasReacted = reaction.users.some((u) => u._id === user?._id);
        return (
          <button
            key={reaction.emoji}
            onClick={() => handleReactionClick(reaction.emoji, hasReacted)}
            className={`
              flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
              transition-all hover:scale-110
              ${
                hasReacted
                  ? "bg-primary/20 border border-primary/50"
                  : "bg-muted border border-border hover:bg-muted/80"
              }
            `}
          >
            <span>{reaction.emoji}</span>
            <span className={hasReacted ? "text-primary font-medium" : "text-muted-foreground"}>
              {reaction.count}
            </span>
          </button>
        );
      })}
      <button
        onClick={handleAddReaction}
        className="flex items-center justify-center w-6 h-6 rounded-full bg-muted hover:bg-muted/80 transition-colors"
      >
        <Plus className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}
