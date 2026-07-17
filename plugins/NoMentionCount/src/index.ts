import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

// Initialize storage structures
if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];
if (!storage.hiddenUserIds) storage.hiddenUserIds = [];
if (!storage.whitelistedUserIds) storage.whitelistedUserIds = [];

let patches: (() => void)[] = [];

// In-memory sets to track channels/guilds that currently have active whitelisted pings
const activeWhitelistChannels = new Set<string>();
const activeWhitelistGuilds = new Set<string>();

export default {
  onLoad() {
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    const GuildReadStateStore = findByStoreName("GuildReadStateStore") || findByProps("getMentionCount", "getGuildUnreadMentionCount");
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");
    const FolderStore = findByProps("getGuildFolders");
    const Dispatcher = findByProps("dispatch", "subscribe");

    // 1. Dispatch Interceptor (Manages blacklists, whitelists, and clears dynamic states)
    if (Dispatcher && typeof Dispatcher.addInterceptor === "function") {
      const cancelInterceptor = Dispatcher.addInterceptor((event) => {
        // Track new incoming pings
        if (event.type === "MESSAGE_CREATE") {
          const message = event.message;
          const authorId = message?.author?.id;
          const channelId = message?.channel_id;
          const guildId = event.guildId;

          if (!authorId) return false;

          // RULE A: Globally block user if they are on the hidden user list
          if (storage.hiddenUserIds.includes(authorId)) {
            message.mentioned = false;
            message.mentionEveryone = false;
            if (Array.isArray(message.mentions)) {
              message.mentions = [];
            }
            return false;
          }

          // RULE B: If a whitelisted user pings you, mark their location as an active bypass exception
          if (message.mentioned && storage.whitelistedUserIds.includes(authorId)) {
            if (channelId) activeWhitelistChannels.add(channelId);
            if (guildId) activeWhitelistGuilds.add(guildId);
          }
        }

        // Clean up tracking when you read the channel or mark it read
        if (event.type === "CHANNEL_SELECT" || event.type === "MARK_CHANNEL_READ") {
          if (event.channelId) activeWhitelistChannels.delete(event.channelId);
          if (event.guildId) activeWhitelistGuilds.delete(event.guildId);
        }

        return false;
      });

      patches.push(cancelInterceptor);
    }

    // 2. Folder Guild List Filtering (Exempts folder filtering if a whitelist ping is active)
    if (FolderStore && FolderStore.getGuildFolders) {
      patches.push(
        after("getGuildFolders", FolderStore, (args, returnValue) => {
          if (returnValue && Array.isArray(returnValue)) {
            return returnValue.map(folder => {
              const guildIds = folder.guildIds || [];
              const cleanedGuildIds = guildIds.filter(id => {
                // If the server has an active whitelist ping, don't hide it from folder calculations
                if (activeWhitelistGuilds.has(id)) return true;
                return !storage.hiddenGuildIds.includes(id);
              });
              return { ...folder, guildIds: cleanedGuildIds };
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
          // If this channel has an active whitelist ping bypass, let the true mention count pass
          if (activeWhitelistChannels.has(id)) return returnValue;

          if (storage.hiddenChannelIds.includes(id) || storage.hiddenGuildIds.includes(id)) {
            return 0;
          }
          return returnValue;
        })
      );
    }

    // 4. Guild / Server Mention Aggregates
    if (GuildMentionStore) {
      const methodsToPatch = ["getTotalMentionCount", "getGuildUnreadMentionCount", "getMentionCount"];
      for (const method of methodsToPatch) {
        if (typeof GuildMentionStore[method] === "function") {
          patches.push(
            after(method, GuildMentionStore, ([guildId], returnValue) => {
              if (activeWhitelistGuilds.has(guildId)) return returnValue;

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
      const guildMethods = ["getMentionCount", "getGuildUnreadMentionCount", "getTotalMentionCount", "hasUnread", "getUnreadCount"];
      for (const method of guildMethods) {
        if (typeof GuildReadStateStore[method] === "function") {
          patches.push(
            after(method, GuildReadStateStore, ([guildId], returnValue) => {
              if (activeWhitelistGuilds.has(guildId)) return returnValue;

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
              if (modifiedState[id] && !activeWhitelistChannels.has(id)) {
                modifiedState[id] = { ...modifiedState[id], mentionCount: 0, _unreadCount: 0, unreadCount: 0 };
              }
            }

            for (const id of storage.hiddenGuildIds) {
              if (modifiedState[id] && !activeWhitelistGuilds.has(id)) {
                modifiedState[id] = { ...modifiedState[id], mentionCount: 0, _unreadCount: 0, unreadCount: 0 };
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
            if (activeWhitelistChannels.has(id) || activeWhitelistGuilds.has(id)) return returnValue;

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
            if (activeWhitelistChannels.has(id) || activeWhitelistGuilds.has(id)) return returnValue;

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
    activeWhitelistChannels.clear();
    activeWhitelistGuilds.clear();
  },

  settings: Settings,
};
