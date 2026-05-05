import { chatService } from "@/services/chatService";
import { conversationService } from "@/services/conversationService";
import type { ChatState } from "@/types/store";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";
import { useSocketStore } from "./useSocketStore";

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false, // convo loading
      messageLoading: false,
      loading: false,
      typingUsers: {}, // Track typing users per conversation

      setActiveConversation: (id) => set({ activeConversationId: id }),
      
      setTypingUsers: (conversationId, users) => {
        set((state) => ({
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: users
          }
        }));
      },

      addTypingUser: (conversationId, userId, userName) => {
        set((state) => {
          const currentUsers = state.typingUsers[conversationId] || [];
          // Check if user already in list
          if (currentUsers.some(u => u.userId === userId)) {
            return state;
          }
          return {
            typingUsers: {
              ...state.typingUsers,
              [conversationId]: [...currentUsers, { userId, userName }]
            }
          };
        });
      },

      removeTypingUser: (conversationId, userId) => {
        set((state) => {
          const currentUsers = state.typingUsers[conversationId] || [];
          return {
            typingUsers: {
              ...state.typingUsers,
              [conversationId]: currentUsers.filter(u => u.userId !== userId)
            }
          };
        });
      },

      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          convoLoading: false,
          messageLoading: false,
          typingUsers: {},
        });
      },
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();

          // Normalize conversations - ensure unreadCounts exists
          const normalizedConversations = conversations.map(convo => ({
            ...convo,
            unreadCounts: convo.unreadCounts || {}
          }));

          // Remove duplicates - keep the one with latest message
          const uniqueConversations = normalizedConversations.reduce((acc, convo) => {
            if (convo.type === 'direct') {
              // Find if we already have a conversation with same participants
              const existingIndex = acc.findIndex(c => {
                if (c.type !== 'direct') return false;
                
                // Check if participants match
                const convoParticipantIds = convo.participants.map((p: any) => 
                  typeof p === 'string' ? p : (p._id || p.userId?._id)
                ).sort();
                
                const existingParticipantIds = c.participants.map((p: any) => 
                  typeof p === 'string' ? p : (p._id || p.userId?._id)
                ).sort();
                
                return JSON.stringify(convoParticipantIds) === JSON.stringify(existingParticipantIds);
              });

              if (existingIndex !== -1) {
                // Keep the one with more recent message
                const existing = acc[existingIndex];
                const convoTime = convo.lastMessageAt ? new Date(convo.lastMessageAt).getTime() : 0;
                const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
                
                if (convoTime > existingTime) {
                  acc[existingIndex] = convo;
                }
              } else {
                acc.push(convo);
              }
            } else {
              acc.push(convo);
            }
            
            return acc;
          }, [] as typeof normalizedConversations);

          set({ conversations: uniqueConversations, convoLoading: false });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchConversations:", error);
          set({ convoLoading: false });
        }
      },
      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const { user } = useAuthStore.getState();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

        const current = messages?.[convoId];
        const nextCursor =
          current?.nextCursor === undefined ? "" : current?.nextCursor;

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } = await chatService.fetchMessages(
            convoId,
            nextCursor
          );

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === user?._id || m.sender?._id === user?._id,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = prev.length > 0 ? [...processed, ...prev] : processed;

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      sendDirectMessage: async (recipientId, content, imgUrl, conversationId, replyTo) => {
        try {
          const { activeConversationId, addMessage } = get();
          const convoId = conversationId || activeConversationId;
          
          const message = await chatService.sendDirectMessage(
            recipientId,
            content,
            imgUrl,
            convoId || undefined,
            replyTo || undefined
          );
          
          // Add message to local store immediately (optimistic update)
          if (message) {
            await addMessage(message);
          }
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === convoId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi direct message", error);
        }
      },
      sendGroupMessage: async (conversationId, content, imgUrl, replyTo) => {
        try {
          const { addMessage } = get();
          
          const message = await chatService.sendGroupMessage(conversationId, content, imgUrl, replyTo);
          
          // Add message to local store immediately (optimistic update)
          if (message) {
            await addMessage(message);
          }
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra gửi group message", error);
        }
      },
      sendMessageWithFile: async (conversationId, content, file, replyTo) => {
        try {
          await chatService.sendMessageWithFile(conversationId, content, file, replyTo);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId ? { ...c, seenBy: [] } : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi file", error);
          throw error;
        }
      },
      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const { fetchMessages } = get();

          // Set isOwn based on current user
          message.isOwn = message.senderId === user?._id || message.sender?._id === user?._id;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];

          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            if (prevItems.some((m) => m._id === message._id)) {
              return state;
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [...prevItems, message],
                  hasMore: state.messages[convoId]?.hasMore ?? false,
                  nextCursor: state.messages[convoId]?.nextCursor ?? undefined,
                },
              },
              // NOTE: conversation.lastMessage is updated by useSocketStore handler,
              // NOT here, to avoid race conditions with updateConversation
            };
          });
        } catch (error) {
          console.error("Lỗi khi add message:", error);
        }
      },
      updateConversation: (conversation: any) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c
          ),
        }));
      },
      markAsSeen: async () => {
        try {
          const { user } = useAuthStore.getState();
          const { activeConversationId, conversations } = get();

          if (!activeConversationId || !user) {
            return;
          }

          const convo = conversations.find((c) => c._id === activeConversationId);

          if (!convo) {
            return;
          }

          if ((convo.unreadCounts?.[user._id] ?? 0) === 0) {
            return;
          }

          await chatService.markAsSeen(activeConversationId);

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId && c.lastMessage
                ? {
                    ...c,
                    unreadCounts: {
                      ...c.unreadCounts,
                      [user._id]: 0,
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi markAsSeen trong store", error);
        }
      },
      addConvo: (convo) => {
        set((state) => {
          // Check if conversation already exists
          const exists = state.conversations.some(
            (c) => c._id.toString() === convo._id.toString()
          );

          if (exists) {
            // If exists, update it
            return {
              conversations: state.conversations.map(c => 
                c._id.toString() === convo._id.toString() ? convo : c
              ),
            };
          }

          // Add new conversation (don't auto-activate)
          return {
            conversations: [convo, ...state.conversations],
          };
        });
      },
      createConversation: async (type, name, memberIds) => {
        try {
          set({ loading: true });
          const conversation = await chatService.createConversation(
            type,
            name,
            memberIds
          );

          get().addConvo(conversation);
          set({ activeConversationId: conversation._id });

          useSocketStore
            .getState()
            .socket?.emit("join-conversation", conversation._id);
          
          return conversation._id;
        } catch (error) {
          console.error("Lỗi xảy ra khi gọi createConversation trong store", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      // ============ MESSAGE ACTIONS ============
      editMessage: async (messageId: string, content: string) => {
        try {
          const updatedMessage = await chatService.editMessage(messageId, content);
          
          set((state) => {
            const convoId = get().activeConversationId;
            if (!convoId) return state;

            const messages = state.messages[convoId]?.items ?? [];
            const updatedMessages = messages.map((m) =>
              m._id === messageId ? { ...m, ...updatedMessage } : m
            );

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...state.messages[convoId],
                  items: updatedMessages,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi edit message:", error);
          throw error;
        }
      },

      deleteMessage: async (messageId: string) => {
        try {
          await chatService.deleteMessage(messageId);
          
          set((state) => {
            const convoId = get().activeConversationId;
            if (!convoId) return state;

            const messages = state.messages[convoId]?.items ?? [];
            const updatedMessages = messages.filter((m) => m._id !== messageId);

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...state.messages[convoId],
                  items: updatedMessages,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi delete message:", error);
          throw error;
        }
      },

      addReaction: async (messageId: string, emoji: string) => {
        try {
          const updatedMessage = await chatService.addReaction(messageId, emoji);
          
          set((state) => {
            const convoId = get().activeConversationId;
            if (!convoId) return state;

            const messages = state.messages[convoId]?.items ?? [];
            const updatedMessages = messages.map((m) =>
              m._id === messageId ? { ...m, reactions: updatedMessage.reactions } : m
            );

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...state.messages[convoId],
                  items: updatedMessages,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi add reaction:", error);
          throw error;
        }
      },

      removeReaction: async (messageId: string, emoji: string) => {
        try {
          await chatService.removeReaction(messageId, emoji);
          
          set((state) => {
            const convoId = get().activeConversationId;
            if (!convoId) return state;

            const messages = state.messages[convoId]?.items ?? [];
            const updatedMessages = messages.map((m) => {
              if (m._id === messageId && m.reactions) {
                return {
                  ...m,
                  reactions: m.reactions.filter((r) => r.emoji !== emoji),
                };
              }
              return m;
            });

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...state.messages[convoId],
                  items: updatedMessages,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi remove reaction:", error);
          throw error;
        }
      },

      forwardMessage: async (messageId: string, conversationIds: string[]) => {
        try {
          await chatService.forwardMessage(messageId, conversationIds);
        } catch (error) {
          console.error("Lỗi khi forward message:", error);
          throw error;
        }
      },

      searchMessages: async (conversationId: string, query: string) => {
        try {
          const result = await chatService.searchMessages(conversationId, query);
          return result.data;
        } catch (error) {
          console.error("Lỗi khi search messages:", error);
          throw error;
        }
      },

      getPinnedMessages: async (conversationId: string) => {
        try {
          // Clean conversationId to remove any trailing characters
          const cleanConversationId = conversationId.split(':')[0];
          console.log('Getting pinned messages for conversation:', cleanConversationId);
          
          const pinnedMessages = await chatService.getPinnedMessages(cleanConversationId);
          return pinnedMessages;
        } catch (error) {
          console.error("Lỗi khi get pinned messages:", error);
          // Return empty array instead of throwing to prevent UI crash
          return [];
        }
      },

      getMediaMessages: async (conversationId: string) => {
        try {
          const result = await chatService.getMediaMessages(conversationId);
          return result.data;
        } catch (error) {
          console.error("Lỗi khi get media messages:", error);
          throw error;
        }
      },

      // ============ CONVERSATION ACTIONS ============
      createDirectConversation: async (userId: string) => {
        try {
          set({ loading: true });
          
          // Check if conversation already exists
          const existingConvo = get().conversations.find(convo => {
            if (convo.type !== 'direct') return false;
            
            return convo.participants?.some((p: any) => {
              const participantId = typeof p === 'string' ? p : (p._id || p.userId?._id);
              return participantId?.toString() === userId.toString();
            });
          });

          if (existingConvo) {
            // If exists, just set it as active and return
            set({ activeConversationId: existingConvo._id });
            return existingConvo;
          }

          // Create new conversation
          const response = await conversationService.createDirectConversation(userId);
          const conversation = response.conversation;
          
          // Add to store
          get().addConvo(conversation);
          
          // Join socket room
          useSocketStore.getState().socket?.emit("join-conversation", conversation._id);
          
          return conversation;
        } catch (error) {
          console.error("Lỗi khi create direct conversation:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      createGroupConversation: async (
        groupName: string,
        participantIds: string[],
        description?: string,
        avatar?: string
      ) => {
        try {
          set({ loading: true });
          const conversation = await conversationService.createGroupConversation(
            groupName,
            participantIds,
            description,
            avatar
          );
          get().addConvo(conversation);
          useSocketStore.getState().socket?.emit("join-conversation", conversation._id);
          return conversation;
        } catch (error) {
          console.error("Lỗi khi create group conversation:", error);
          throw error;
        } finally {
          set({ loading: false });
        }
      },

      deleteConversation: async (conversationId: string) => {
        try {
          await conversationService.deleteConversation(conversationId);
          
          set((state) => ({
            conversations: state.conversations.filter((c) => c._id !== conversationId),
            activeConversationId: state.activeConversationId === conversationId 
              ? null 
              : state.activeConversationId,
          }));
        } catch (error) {
          console.error("Lỗi khi delete conversation:", error);
          throw error;
        }
      },

      disbandGroup: async (conversationId: string) => {
        try {
          // Clean conversationId to remove any trailing characters
          const cleanConversationId = conversationId.split(':')[0];
          console.log('Disbanding group:', cleanConversationId);
          
          await conversationService.disbandGroup(cleanConversationId);
          
          set((state) => ({
            conversations: state.conversations.filter((c) => c._id !== cleanConversationId),
            activeConversationId: state.activeConversationId === cleanConversationId 
              ? null 
              : state.activeConversationId,
          }));
        } catch (error) {
          console.error("Lỗi khi giải tán nhóm:", error);
          throw error;
        }
      },

      leaveConversation: async (conversationId: string) => {
        try {
          await conversationService.leaveConversation(conversationId);
          
          set((state) => ({
            conversations: state.conversations.filter((c) => c._id !== conversationId),
            activeConversationId: state.activeConversationId === conversationId 
              ? null 
              : state.activeConversationId,
          }));
        } catch (error) {
          console.error("Lỗi khi leave conversation:", error);
          throw error;
        }
      },

      togglePinConversation: async (conversationId: string) => {
        try {
          await conversationService.togglePinConversation(conversationId);
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? { ...c, isPinned: !c.isPinned }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi toggle pin conversation:", error);
          throw error;
        }
      },

      addParticipant: async (conversationId: string, userId: string) => {
        try {
          await conversationService.addParticipant(conversationId, userId);
          // Refresh conversation details or update locally
        } catch (error) {
          console.error("Lỗi khi add participant:", error);
          throw error;
        }
      },

      removeParticipant: async (conversationId: string, userId: string) => {
        try {
          await conversationService.removeParticipant(conversationId, userId);
          // Refresh conversation details or update locally
        } catch (error) {
          console.error("Lỗi khi remove participant:", error);
          throw error;
        }
      },

      updateGroupInfo: async (
        conversationId: string,
        data: {
          groupName?: string;
          groupDescription?: string;
          groupAvatar?: string;
        }
      ) => {
        try {
          await conversationService.updateGroupInfo(conversationId, data);
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId && c.group
                ? {
                    ...c,
                    group: {
                      ...c.group,
                      name: data.groupName ?? c.group.name,
                      description: data.groupDescription ?? c.group.description,
                      avatar: data.groupAvatar ?? c.group.avatar,
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi update group info:", error);
          throw error;
        }
      },

      updateGroupSettings: async (
        conversationId: string,
        settings: {
          onlyAdminsCanSend?: boolean;
          onlyAdminsCanEditGroup?: boolean;
          allowMembersToInvite?: boolean;
        }
      ) => {
        try {
          await conversationService.updateGroupSettings(conversationId, settings);
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    settings: { 
                      onlyAdminsCanSend: false,
                      onlyAdminsCanEditGroup: false,
                      allowMembersToInvite: true,
                      ...c.settings, 
                      ...settings 
                    },
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi update group settings:", error);
          throw error;
        }
      },

      pinMessage: async (conversationId: string, messageId: string) => {
        try {
          await conversationService.pinMessage(conversationId, messageId);
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    pinnedMessages: [...(c.pinnedMessages ?? []), messageId],
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi pin message:", error);
          throw error;
        }
      },

      unpinMessage: async (conversationId: string, messageId: string) => {
        try {
          await conversationService.unpinMessage(conversationId, messageId);
          
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    pinnedMessages: (c.pinnedMessages ?? []).filter((id) => id !== messageId),
                  }
                : c
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi unpin message:", error);
          throw error;
        }
      },

      addParticipantToGroup: async (conversationId: string, userId: string) => {
        try {
          await conversationService.addParticipant(conversationId, userId);
          // Refresh conversation to get updated participants
          await get().fetchConversations();
        } catch (error) {
          console.error("Lỗi khi add participant:", error);
          throw error;
        }
      },

      removeParticipantFromGroup: async (conversationId: string, userId: string) => {
        try {
          await conversationService.removeParticipant(conversationId, userId);
          // Refresh conversation to get updated participants
          await get().fetchConversations();
        } catch (error) {
          console.error("Lỗi khi remove participant:", error);
          throw error;
        }
      },

      addAdminToGroup: async (conversationId: string, userId: string) => {
        try {
          await conversationService.addAdmin(conversationId, userId);
          // Refresh conversation to get updated admins
          await get().fetchConversations();
        } catch (error) {
          console.error("Lỗi khi add admin:", error);
          throw error;
        }
      },

      removeAdminFromGroup: async (conversationId: string, userId: string) => {
        try {
          await conversationService.removeAdmin(conversationId, userId);
          // Refresh conversation to get updated admins
          await get().fetchConversations();
        } catch (error) {
          console.error("Lỗi khi remove admin:", error);
          throw error;
        }
      },

      updateNotificationSettings: async (
        conversationId: string,
        settings: {
          enabled?: boolean;
          mentions?: boolean;
          replies?: boolean;
          muteUntil?: string | null | "forever";
        }
      ) => {
        try {
          await conversationService.updateNotificationSettings(conversationId, settings);
          // Update locally if needed
        } catch (error) {
          console.error("Lỗi khi update notification settings:", error);
          throw error;
        }
      },
    }),
    {
      name: "chat-storage",
      // Persist ONLY activeConversationId — NOT conversations (always fetch fresh from DB)
      // Stale localStorage conversations with outdated lastMessage was causing the bug
      partialize: (state) => ({
        activeConversationId: state.activeConversationId,
      }),
      onRehydrateStorage: () => () => {
        // Restore active conversation on page refresh
      },
    }
  )
);
