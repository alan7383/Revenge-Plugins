import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

// Initialize storage arrays if they don't exist
if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];
if (!storage.hiddenUserIds) storage.hiddenUserIds = [];

let patches: (() => void)[] = [];

export default {
  onLoad() {
    // Collect all potential Mention/Unread Stores
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    const GuildReadStateStore = findByStoreName("GuildReadStateStore") || findByProps("getMentionCount", "getGuildUnreadMentionCount");
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");
    const FolderStore = findByProps("getGuildFolders");
    
    // Discord's central dispatcher
    const Dispatcher = findByProps("dispatch", "subscribe");

    // 1. Raw Dispatch Interceptor (Strips mentions from specific blacklisted users in real-time)
    if (Dispatcher && typeof Dispatcher.addInterceptor === "function") {
      const cancelInterceptor = Dispatcher.addInterceptor((event) => {
        if (event.type === "MESSAGE_CREATE") {
          const message = event.message;
          const authorId = message?.author?.id;

          // Quick exit if the message author is not blacklisted
          if (!authorId || !storage.hiddenUserIds.includes(authorId)) {
            return false;
          }

          // Strip mention status so the local client ignores the ping entirely
          message.mentioned = false;
          message.mentionEveryone = false;
          
          if (Array.isArray(message.mentions)) {
            message.mentions = [];
          }
        }
        return false;
      });

      // Register the interceptor cleanup function
      patches.push(cancelInterceptor);
    }

    // 2. Patch Folder Guild Lists (Prevents hidden servers from bloating folder badges)
    if (FolderStore && FolderStore.getGuildFolders) {
      patches.push(
        after("getGuildFolders", FolderStore, (args, returnValue) => {
          if (returnValue && Array.isArray(returnValue)) {
            return returnValue.map(folder => {
              const guildIds = folder.guildIds || [];
              const cleanedGuildIds = guildIds.filter(
                id => !storage.hiddenGuildIds.includes(id)
              );
              return {
                ...folder,
                guildIds: cleanedGuildIds
              };
            });
          }
          return returnValue;
        })
      );
    }

    // 3. Channel Mentions
    if (MentionStore) {
      patches.push(
        after("getMentionCount", MentionStore, ([id], returnValue) => {
          if (storage.hiddenChannelIds.includes(id) || storage.hiddenGuildIds.includes(id)) {
            return 0;
          }
          return returnValue;
        })
      );
    }

    // 4. Guild / Server Mention Aggregates
    if (GuildMentionStore) {
      const methodsToPatch = [
        "getTotalMentionCount", 
        "getGuildUnreadMentionCount", 
        "getMentionCount"
      ];
      
      for (const method of methodsToPatch) {
        if (typeof GuildMentionStore[method] === "function") {
          patches.push(
            after(method, GuildMentionStore, ([guildId], returnValue) => {
              if (storage.hiddenGuildIds.includes(guildId)) {
                return 0;
              }
              return returnValue;
            })
          );
        }
      }
    }

    // 5. Guild Read State Store
    if (GuildReadStateStore) {
      const guildMethods = [
        "getMentionCount",
        "getGuildUnreadMentionCount",
        "getTotalMentionCount",
        "hasUnread",
        "getUnreadCount"
      ];

      for (const method of guildMethods) {
        if (typeof GuildReadStateStore[method] === "function") {
          patches.push(
            after(method, GuildReadStateStore, ([guildId], returnValue) => {
              if (storage.hiddenGuildIds.includes(guildId)) {
                return method === "hasUnread" ? false : 0;
              }
              return returnValue;
            })
          );
        }
      }
    }

    // 6. Raw ReadStates Map Interception
    if (ReadStateStore && ReadStateStore.getAllReadStates) {
      patches.push(
        after("getAllReadStates", ReadStateStore, (args, returnValue) => {
          if (returnValue && typeof returnValue === "object") {
            const modifiedState = { ...returnValue };

            for (const id of storage.hiddenChannelIds) {
              if (modifiedState[id]) {
                modifiedState[id] = {
                  ...modifiedState[id],
                  mentionCount: 0,
                  _unreadCount: 0,
                  unreadCount: 0,
                };
              }
            }

            for (const id of storage.hiddenGuildIds) {
              if (modifiedState[id]) {
                modifiedState[id] = {
                  ...modifiedState[id],
                  mentionCount: 0,
                  _unreadCount: 0,
                  unreadCount: 0,
                };
              }
            }

            return modifiedState;
          }
          return returnValue;
        })
      );
    }

    // 7. General Unread Indicators / Dots Fallback
    if (UnreadsStore) {
      if (UnreadsStore.getUnreadCount) {
        patches.push(
          after("getUnreadCount", UnreadsStore, ([id], returnValue) => {
            if (storage.hiddenChannelIds.includes(id) || storage.hiddenGuildIds.includes(id)) {
              return 0;
            }
            return returnValue;
          })
        );
      }
      if (UnreadsStore.hasUnread) {
        patches.push(
          after("hasUnread", UnreadsStore, ([id], returnValue) => {
            if (storage.hiddenChannelIds.includes(id) || storage.hiddenGuildIds.includes(id)) {
              return false;
            }
            return returnValue;
          })
        );
      }
    }
  },

  onUnload() {
    for (const unpatch of patches) {
      unpatch();
    }
    patches = [];
  },

  settings: Settings,
};
