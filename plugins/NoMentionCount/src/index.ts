import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

// Initialize storage structures securely
if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];
if (!storage.hiddenUserIds) storage.hiddenUserIds = [];
if (!storage.whitelistedUserIds) storage.whitelistedUserIds = [];
if (!storage.whitelistedMentionChannels) storage.whitelistedMentionChannels = {};

let patches: (() => void)[] = [];

const isHiddenChannel = (id: string) => storage.hiddenChannelIds.includes(id);
const isHiddenGuild = (id: string) => storage.hiddenGuildIds.includes(id);
const isWhitelistedUser = (id: string) => storage.whitelistedUserIds.includes(id);
const hasWhitelistedMention = (id: string) => !!storage.whitelistedMentionChannels[id];

export default {
  onLoad() {
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 
    const GuildReadStateStore = findByStoreName("GuildReadStateStore") || findByProps("getMentionCount", "getGuildUnreadMentionCount");
    const ReadStateStore = findByStoreName("ReadStateStore") || findByProps("getAllReadStates");
    const UnreadsStore = findByProps("getUnreadCount") || findByProps("hasUnread");
    const Dispatcher = findByProps("dispatch", "subscribe");

    // 1. Raw Dispatch Interceptor (Handles Incoming Blocker and Whitelist Traps)
    if (Dispatcher && typeof Dispatcher.addInterceptor === "function") {
      const cancelInterceptor = Dispatcher.addInterceptor((event) => {
        if (event.type === "MESSAGE_CREATE") {
          const message = event.message;
          const authorId = message?.author?.id;
          const channelId = message?.channel_id;
          const guildId = message?.guild_id || event.guildId;

          /* --- Whitelisted User Mention Loop --- */
          if (
            authorId && 
            channelId && 
            guildId && 
            isWhitelistedUser(authorId) && 
            Array.isArray(message.mentions) && 
            message.mentions.some((mention: any) => mention.id === storage.userId)
          ) {
            storage.whitelistedMentionChannels = {
              ...storage.whitelistedMentionChannels,
              [channelId]: guildId
            };
            
            // Force client update to repaint layout instantly
            if (typeof Dispatcher.dispatch === "function") {
              Dispatcher.dispatch({ type: "NATIVE_APP_BACKGROUND_STATE_CHANGE", styleOverrideBypass: true });
            }
          }

          /* --- Blacklisted User Mention Dropper --- */
          if (authorId && storage.hiddenUserIds.includes(authorId)) {
            message.mentioned = false;
            message.mentionEveryone = false;
            if (Array.isArray(message.mentions)) {
              message.mentions = [];
            }
          }
        }
        return false;
      });
      patches.push(cancelInterceptor);
    }

    // 2. Channel Mention Counts Override
    if (MentionStore) {
      patches.push(
        after("getMentionCount", MentionStore, ([id], returnValue) => {
          if (isHiddenChannel(id)) {
            return hasWhitelistedMention(id) ? 1 : 0;
          }
          return returnValue;
        })
      );
    }

    // 3. Guild Mention Aggregates Override
    if (GuildMentionStore) {
      const methodsToPatch = ["getTotalMentionCount", "getGuildUnreadMentionCount", "getMentionCount"];
      for (const method of methodsToPatch) {
        if (typeof GuildMentionStore[method] === "function") {
          patches.push(
            after(method, GuildMentionStore, ([guildId], returnValue) => {
              if (isHiddenGuild(guildId)) {
                const hasWhitelistMention = Object.values(storage.whitelistedMentionChannels).includes(guildId);
                return hasWhitelistMention ? 1 : 0;
              }
              return returnValue;
            })
          );
        }
      }
    }

    // 4. Guild Read State Store Override
    if (GuildReadStateStore) {
      const guildMethods = ["getMentionCount", "getGuildUnreadMentionCount", "getTotalMentionCount", "hasUnread", "getUnreadCount"];
      for (const method of guildMethods) {
        if (typeof GuildReadStateStore[method] === "function") {
          patches.push(
            after(method, GuildReadStateStore, ([guildId], returnValue) => {
              if (isHiddenGuild(guildId)) {
                const hasWhitelistMention = Object.values(storage.whitelistedMentionChannels).includes(guildId);
                if (method === "hasUnread") return hasWhitelistMention;
                return hasWhitelistMention ? 1 : 0;
              }
              return returnValue;
            })
          );
        }
      }
    }

    // 5. Raw ReadState Global Map Interception
    if (ReadStateStore && ReadStateStore.getAllReadStates) {
      patches.push(
        after("getAllReadStates", ReadStateStore, (args, returnValue) => {
          if (returnValue && typeof returnValue === "object") {
            const modifiedState = { ...returnValue };

            // Channel Clear-out
            for (const id of storage.hiddenChannelIds) {
              if (modifiedState[id]) {
                modifiedState[id] = { ...modifiedState[id], mentionCount: 0, _unreadCount: 0, unreadCount: 0 };
              }
            }

            // Server Clear-out / Dynamic 1 Injector
            for (const id of storage.hiddenGuildIds) {
              if (modifiedState[id]) {
                const hasWhitelistMention = Object.values(storage.whitelistedMentionChannels).includes(id);
                modifiedState[id] = {
                  ...modifiedState[id],
                  mentionCount: hasWhitelistMention ? 1 : 0,
                  _unreadCount: hasWhitelistMention ? 1 : 0,
                  unreadCount: hasWhitelistMention ? 1 : 0,
                };
              }
            }

            return modifiedState;
          }
          return returnValue;
        })
      );
    }

    // 6. General Unread System Indicators
    if (UnreadsStore) {
      if (typeof UnreadsStore.getUnreadCount === "function") {
        patches.push(
          after("getUnreadCount", UnreadsStore, ([id], returnValue) => {
            if (isHiddenChannel(id)) return hasWhitelistedMention(id) ? 1 : 0;
            return returnValue;
          })
        );
      }
      if (typeof UnreadsStore.hasUnread === "function") {
        patches.push(
          after("hasUnread", UnreadsStore, ([id], returnValue) => {
            if (isHiddenChannel(id)) return hasWhitelistedMention(id);
            return returnValue;
          })
        );
      }
    }

    // 7. Stable Read Detection & Cleansing Routine
    if (Dispatcher && typeof Dispatcher.subscribe === "function") {
      const handleReadStateClear = (event: any) => {
        const channelId = event?.channelId || event?.id;
        if (channelId && storage.whitelistedMentionChannels[channelId]) {
          const updated = { ...storage.whitelistedMentionChannels };
          delete updated[channelId];
          storage.whitelistedMentionChannels = updated;
        }
      };

      // Handle standard updates and manual read action sweeps natively
      const unsubReadState = Dispatcher.subscribe("CHANNEL_READ_STATE_UPDATE", handleReadStateClear);
      const unsubMarkRead = Dispatcher.subscribe("MARK_CHANNEL_READ", handleReadStateClear);

      patches.push(() => {
        if (typeof unsubReadState === "function") unsubReadState();
        if (typeof unsubMarkRead === "function") unsubMarkRead();
      });
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
