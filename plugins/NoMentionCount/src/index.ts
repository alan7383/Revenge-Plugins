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

    // 1. Channel Mentions
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

    // 2. Guild / Server Mention Aggregates
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

    // 3. Guild Read State Store (The secret culprit for Guild List Badges)
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
                // Return false for unreads, 0 for numeric counts
                return method === "hasUnread" ? false : 0;
              }
              return returnValue;
            })
          );
        }
      }
    }

    // 4. Raw ReadStates Map Interception
    if (ReadStateStore && ReadStateStore.getAllReadStates) {
      patches.push(
        after("getAllReadStates", ReadStateStore, (args, returnValue) => {
          if (returnValue && typeof returnValue === "object") {
            const modifiedState = { ...returnValue };

            // Reset channel level unreads
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

            // Reset guild level unreads
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

    // 5. General Unread Indicators / Dots Fallback
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
