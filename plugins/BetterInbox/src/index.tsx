import { FluxDispatcher } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import type { LocalStorage, MentionSubCategory } from "./types";
import NotificationCenterUI from "./components/NotificationCenterUI";
import { patchYouBar } from "./youbar";

// Retrieve Discord Stores safely
const UserStore: any = findByStoreName("UserStore");
const ChannelStore: any = findByStoreName("ChannelStore");
const GuildStore: any = findByStoreName("GuildStore");
const MessageStore: any = findByStoreName("MessageStore");
const GuildMemberStore: any = findByStoreName("GuildMemberStore");

const pluginStorage = (storage as LocalStorage) || { notifications: [] };

// Array to track active unpatch functions
const unpatches: (() => void)[] = [];

function processNotification(type: string, payload: any): void {
  try {
    const currentUser = UserStore?.getCurrentUser();
    if (!currentUser) return;

    // Handle both wrapped payload.message and direct payload
    const msg = payload.message || payload;
    const author = msg?.author;

    // Ignore self actions
    if (author?.id === currentUser.id || payload.user_id === currentUser.id) return;

    const channelId = msg?.channel_id || msg?.channelId || payload.channel_id;
    const channel = ChannelStore?.getChannel(channelId);
    const guild = channel?.guild_id ? GuildStore?.getGuild(channel.guild_id) : undefined;

    const guildName = guild?.name || (channel?.isGroupDM() ? "Group DM" : "Direct Message");
    const channelName = channel?.name ? `#${channel.name}` : "DM";
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (!Array.isArray(pluginStorage.notifications)) {
      pluginStorage.notifications = [];
    }

    // -------------------------------------------------------------
    // 1. MESSAGE CREATION (Mentions, Role Mentions & Replies)
    // -------------------------------------------------------------
    if (type === "MESSAGE_CREATE") {
      if (!msg) return;

      // REPLIES (Message type 19 or referenced_message)
      const isReply =
        msg.type === 19 &&
        (msg.referenced_message?.author?.id === currentUser.id ||
         msg.messageReference?.message_id);

      if (isReply) {
        console.log("[BetterInbox] Caught Reply from", author?.globalName || author?.username);
        pluginStorage.notifications = [
          {
            id: msg.id || `${Date.now()}`,
            category: "replies",
            title: `${author?.globalName || author?.username || "Someone"} replied to you`,
            content: msg.content || "",
            guildName,
            channelName,
            guildId: guild?.id,
            channelId,
            messageId: msg.id,
            timestamp,
            author,
          },
          ...pluginStorage.notifications,
        ];
        return;
      }

      // DIRECT USER MENTIONS
      const mentionsArray = Array.isArray(msg.mentions) ? msg.mentions : [];

      const isExplicitlyMentioned =
        msg.mentioned === true ||
        payload.mentioned === true ||
        mentionsArray.some((m: any) =>
          typeof m === "string" ? m === currentUser.id : m?.id === currentUser.id
        );

      const isContentMentioned =
        typeof msg.content === "string" &&
        (msg.content.includes(`<@${currentUser.id}>`) ||
         msg.content.includes(`<@!${currentUser.id}>`));

      const isEveryoneMention = msg.mentionEveryone || msg.mention_everyone;

      // ROLE MENTIONS
      const roleMentions = msg.mention_roles || msg.mentionRoles || payload.mention_roles || [];
      const hasRoleMentions = Array.isArray(roleMentions) && roleMentions.length > 0;

      let isUserRoleMentioned = false;
      if (hasRoleMentions && guild?.id) {
        const member = GuildMemberStore?.getMember(guild.id, currentUser.id);
        const userRoles: string[] = member?.roles || [];
        isUserRoleMentioned = roleMentions.some((roleId: string) => userRoles.includes(roleId));
      }

      // HANDLE MENTIONS LOGIC
      if (isExplicitlyMentioned || isContentMentioned || isEveryoneMention || isUserRoleMentioned) {
        console.log("[BetterInbox] Caught Mention from", author?.globalName || author?.username);

        let subCategory: MentionSubCategory = "people";
        if (isUserRoleMentioned) {
          subCategory = "role";
        } else if (author?.bot) {
          subCategory = "bot";
        }

        pluginStorage.notifications = [
          {
            id: msg.id || `${Date.now()}`,
            category: "mentions",
            subCategory,
            title: isUserRoleMentioned
              ? `${author?.globalName || author?.username || "Someone"} mentioned a role you have`
              : `${author?.globalName || author?.username || "Someone"} mentioned you`,
            content: msg.content || "",
            guildName,
            channelName,
            guildId: guild?.id,
            channelId,
            messageId: msg.id,
            timestamp,
            author,
          },
          ...pluginStorage.notifications,
        ];
        return;
      }
    }

    // -------------------------------------------------------------
    // 2. REACTION ADD
    // -------------------------------------------------------------
    if (type === "MESSAGE_REACTION_ADD") {
      const targetMessageId = payload.message_id || payload.messageId;
      const reactorId = payload.user_id || payload.userId;

      // Ignore if YOU reacted
      if (reactorId === currentUser.id) return;

      const targetMessage = MessageStore?.getMessage(channelId, targetMessageId);

      // STRICT FILTER: If message exists in cache and isn't yours, drop it!
      if (targetMessage && targetMessage.author?.id !== currentUser.id) {
        return;
      }

      const reactorUser =
        payload.member?.user ||
        payload.user ||
        UserStore?.getUser(reactorId);

      const finalAuthor = reactorUser || {
        id: reactorId,
        username: payload.member?.nick || "Someone",
        globalName: payload.member?.nick || "Someone",
        avatar: null,
      };

      const reactorName =
        finalAuthor.globalName ||
        finalAuthor.username ||
        "Someone";

      const emoji = payload.emoji;
      const emojiName = emoji?.name || "an emoji";

      console.log("[BetterInbox] Caught Reaction on your message from", reactorName);

      pluginStorage.notifications = [
        {
          id: `${targetMessageId}-${reactorId}-${Date.now()}`,
          category: "reactions",
          title: `${reactorName} reacted ${emojiName}`,
          content: targetMessage?.content ? `"${targetMessage.content}"` : `Reacted to your message in ${channelName}`,
          guildName,
          channelName,
          guildId: guild?.id,
          channelId,
          messageId: targetMessageId,
          timestamp,
          author: finalAuthor,
        },
        ...pluginStorage.notifications,
      ];
    }
  } catch (err) {
    console.error("[BetterInbox] Listener error:", err);
  }
}

const handleMessageCreate = (payload: any) => processNotification("MESSAGE_CREATE", payload);
const handleReactionAdd = (payload: any) => processNotification("MESSAGE_REACTION_ADD", payload);

export default {
  onLoad: () => {
    console.log("[BetterInbox] Loaded successfully");

    if (!pluginStorage.notifications) {
      pluginStorage.notifications = [];
    }

    FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessageCreate);
    FluxDispatcher.subscribe("MESSAGE_REACTION_ADD", handleReactionAdd);

    try {
      unpatches.push(patchYouBar());
    } catch (err) {
      console.error("[BetterInbox] Failed to patch YouBar:", err);
    }
  },

  onUnload: () => {
    console.log("[BetterInbox] Unloaded");

    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessageCreate);
    FluxDispatcher.unsubscribe("MESSAGE_REACTION_ADD", handleReactionAdd);

    for (const unpatch of unpatches) {
      unpatch?.();
    }
    unpatches.length = 0;
  },

  settings: NotificationCenterUI,
};

