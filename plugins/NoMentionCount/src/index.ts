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

export default {
  onLoad() {
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    const GuildReadStateStore = findByStoreName("GuildReadStateStore") || findByProps("getMentionCount", "getGuildUnreadMentionCount");
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");
    const FolderStore = findByProps("getGuildFolders");
    const Dispatcher = findByProps("dispatch", "subscribe");
    
    // Discord's message internal cache store to verify who actually pinged
    const MessageStore = findByProps("getMessages");
    const ChannelStore = findByProps("getChannel", "getChannels");

    // Helper: Checks if a specific channel has a pending ping from any whitelisted user
    const hasWhitelistedPingInChannel = (channelId: string): boolean => {
      if (storage.whitelistedUserIds.length === 0 || !MessageStore) return false;
      
      const cachedMessages = MessageStore.getMessages(channelId);
      if (!cachedMessages || !cachedMessages._array) return false;

      // Scan cached messages in the channel to see if a whitelisted user pinged you
      return cachedMessages._array.some((msg: any) => 
        msg.mentioned && storage.whitelistedUserIds.includes(msg.author?.id)
      );
    };

    // Helper: Checks if a server contains ANY channel with a whitelisted ping
    const hasWhitelistedPingInGuild = (guildId: string): boolean => {
      if (!ChannelStore || !guildId) return false;
      
      const channels = ChannelStore.getChannels ? ChannelStore.getChannels(guildId) : [];
      const channelList = Array.isArray(channels) ? channels : Object.values(channels);

      return channelList.some((ch: any) => ch && hasWhitelistedPingInChannel(ch.id));
    };

    // 1. Raw Dispatch Interceptor (Globally strips blocked users)
    if (Dispatcher && typeof Dispatcher.addInterceptor === "function") {
      const cancelInterceptor = Dispatcher.addInterceptor((event) => {
        if (event.type === "MESSAGE_CREATE") {
          const message = event.message;
          const authorId = message?.author?.id;

          if (authorId && storage.hiddenUserIds.includes(authorId)) {
            message.mentioned = false;
            message.mentionEveryone = false;
            if (Array.isArray(message.mentions)) message.mentions = [];
          }
        }
        return false;
      });
      patches.push(cancelInterceptor);
    }

    // 2. Folder Guild List Filtering
    if (FolderStore && FolderStore.getGuildFolders) {
      patches.push(
        after("getGuildFolders", FolderStore, (args, returnValue) => {
          if (returnValue && Array.isArray(returnValue)) {
            return returnValue.map(folder => {
              const guildIds = folder.guildIds || [];
              const cleanedGuildIds = guildIds.filter(id => {
                if (hasWhitelistedPingInGuild(id)) return true; // Bypass
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
          if (hasWhitelistedPingInChannel(id)) return returnValue;

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
              if (hasWhitelistedPingInGuild(guildId)) return returnValue;

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
              if (hasWhitelistedPingInGuild(guildId)) return returnValue;

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
              if (modifiedState[id] && !hasWhitelistedPingInChannel(id)) {
                modifiedState[id] = { ...modifiedState[id], mentionCount: 0, _unreadCount: 0, unreadCount: 0 };
              }
            }

            for (const id of storage.hiddenGuildIds) {
              if (modifiedState[id] && !hasWhitelistedPingInGuild(id)) {
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
            if (hasWhitelistedPingInChannel(id) || hasWhitelistedPingInGuild(id)) return returnValue;

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
            if (hasWhitelistedPingInChannel(id) || hasWhitelistedPingInGuild(id)) return returnValue;

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
