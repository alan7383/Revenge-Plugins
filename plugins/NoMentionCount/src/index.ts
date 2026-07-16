import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];

let patches: (() => void)[] = [];

export default {
  onLoad() {
    // Collect all potential Mention/Unread Stores
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    const GuildReadStateStore = findByStoreName("GuildReadStateStore") || findByProps("getMentionCount", "getGuildUnreadMentionCount");
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");
    
    // Folder Store found in our evaluation!
    const FolderStore = findByProps("getGuildFolders");

    // 1. Patch Folder Guild Lists (Prevents hidden servers from bloating folder badges)
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

    // 2. Channel Mentions
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

    // 3. Guild / Server Mention Aggregates
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

    // 4. Guild Read State Store
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

    // 5. Raw ReadStates Map Interception
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

    // 6. General Unread Indicators / Dots Fallback
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
