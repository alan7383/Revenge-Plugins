import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];

let patches: (() => void)[] = [];

export default {
  onLoad() {
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    
    // Using findByStoreName based on the command script!
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");

    // 1. Patch standard getMentionCount
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

    // 2. Patch standard getTotalMentionCount
    if (GuildMentionStore) {
      patches.push(
        after("getTotalMentionCount", GuildMentionStore, ([guildId], returnValue) => {
          if (storage.hiddenGuildIds.includes(guildId)) {
            return 0;
          }
          return returnValue;
        })
      );
    }

    // 3. Deep Raw State Patch: Intercepting the core Read States Map
    if (ReadStateStore && ReadStateStore.getAllReadStates) {
      patches.push(
        after("getAllReadStates", ReadStateStore, (args, returnValue) => {
          if (returnValue && typeof returnValue === "object") {
            // Create a modified shallow copy of the state object
            const modifiedState = { ...returnValue };

            // Clear mention/unread counters for targeted channel IDs
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

            // Clear mention/unread counters for targeted server IDs
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

    // 4. Fallback: Patch standard unread helpers
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
