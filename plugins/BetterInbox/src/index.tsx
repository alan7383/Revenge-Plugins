import { FluxDispatcher } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import type { LocalStorage, MentionSubCategory, NotificationItem } from "./types";
import NotificationCenterUI from "./components/NotificationCenterUI";
import { patchYouBar } from "./youbar";

// Retrieve Discord Stores
const UserStore: any = findByStoreName("UserStore");
const ChannelStore: any = findByStoreName("ChannelStore");
const GuildStore: any = findByStoreName("GuildStore");
const MessageStore: any = findByStoreName("MessageStore");
const GuildMemberStore: any = findByStoreName("GuildMemberStore");

const pluginStorage = (storage as LocalStorage) || { notifications: [] };
const unpatches: (() => void)[] = [];

// In-Memory storage cache with debounced disk write
let memoryNotifications: NotificationItem[] = [];
let saveTimeout: any = null;

function syncStorageDebounced() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    pluginStorage.notifications = memoryNotifications.slice(0, 100);
  }, 5000);
}

// -------------------------------------------------------------
// 1. PROCESS TARGETED MENTIONS / REPLIES
// -------------------------------------------------------------
function processMentionMessage(channelId: string, messageId: string) {
  try {
    const currentUser = UserStore?.getCurrentUser();
    if (!currentUser) return;

    const msg = MessageStore?.getMessage(channelId, messageId);
    const channel = ChannelStore?.getChannel(channelId);
    if (!msg || !channel) return;

    const author = msg.author || UserStore?.getUser(msg.author?.id);
    if (!author || author.id === currentUser.id) return; // Drop own actions

    const guild = channel.guild_id ? GuildStore?.getGuild(channel.guild_id) : undefined;
    const guildName = guild?.name || (channel.isGroupDM() ? "Group DM" : "Direct Message");
    const channelName = channel.name ? `#${channel.name}` : "DM";
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const isReply =
      msg.type === 19 ||
      msg.referenced_message?.author?.id === currentUser.id;

    let category: "mentions" | "replies" = isReply ? "replies" : "mentions";
    let subCategory: MentionSubCategory = "people";

    if (author.bot) {
      subCategory = "bot";
    } else if (msg.mention_roles?.length > 0 || msg.mentionRoles?.length > 0) {
      subCategory = "role";
    }

    const newNotification: NotificationItem = {
      id: msg.id || `${Date.now()}`,
      category,
      subCategory,
      title: isReply
        ? `${author.globalName || author.username || "Someone"} replied to you`
        : subCategory === "role"
        ? `${author.globalName || author.username || "Someone"} mentioned a role you have`
        : `${author.globalName || author.username || "Someone"} mentioned you`,
      content: msg.content || "",
      guildName,
      channelName,
      guildId: guild?.id,
      channelId,
      messageId: msg.id,
      timestamp,
      author,
    };

    memoryNotifications = [newNotification, ...memoryNotifications];
    syncStorageDebounced();
  } catch (err) {
    console.error("[BetterInbox] Mention process error:", err);
  }
}

// -------------------------------------------------------------
// 2. FAST-EXIT INCOMING MESSAGE FILTER
// -------------------------------------------------------------
function handleIncomingMessage(payload: any) {
  try {
    const currentUser = UserStore?.getCurrentUser();
    if (!currentUser) return;

    const msg = payload?.message || payload;
    if (!msg || !msg.channel_id) return;

    // Drop own messages instantly
    if (msg.author?.id === currentUser.id) return;

    // FAST CHECK 1: Direct user mention
    const isDirectMention = msg.mentions?.some((u: any) => u.id === currentUser.id);

    // FAST CHECK 2: Reply to your message
    const isReplyToMe =
      msg.referenced_message?.author?.id === currentUser.id ||
      (msg.type === 19 && msg.referenced_message?.author?.id === currentUser.id);

    // FAST CHECK 3: Role mention matching your roles
    let isRoleMention = false;
    const msgRoles = msg.mention_roles || msg.mentionRoles || [];
    if (msgRoles.length > 0 && msg.guild_id) {
      const myMember = GuildMemberStore?.getMember(msg.guild_id, currentUser.id);
      const myRoles: string[] = myMember?.roles || [];
      isRoleMention = msgRoles.some((roleId: string) => myRoles.includes(roleId));
    }

    // EARLY EXIT: If not for you, stop execution immediately (0.001ms overhead)
    if (!isDirectMention && !isReplyToMe && !isRoleMention) return;

    // Process only guaranteed hits
    processMentionMessage(msg.channel_id, msg.id);
  } catch (err) {
    console.error("[BetterInbox] Incoming message check error:", err);
  }
}

// -------------------------------------------------------------
// 3. REACTION HANDLER (Filtered to your messages)
// -------------------------------------------------------------
function handleReactionAdd(payload: any): void {
  try {
    const currentUser = UserStore?.getCurrentUser();
    if (!currentUser) return;

    const channelId = payload.channel_id || payload.channelId;
    const targetMessageId = payload.message_id || payload.messageId;
    const reactorId = payload.user_id || payload.userId;

    if (reactorId === currentUser.id) return;

    const targetMessage = MessageStore?.getMessage(channelId, targetMessageId);
    if (!targetMessage || targetMessage.author?.id !== currentUser.id) return;

    const channel = ChannelStore?.getChannel(channelId);
    const guild = channel?.guild_id ? GuildStore?.getGuild(channel.guild_id) : undefined;
    const guildName = guild?.name || (channel?.isGroupDM() ? "Group DM" : "Direct Message");
    const channelName = channel?.name ? `#${channel.name}` : "DM";
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const reactorUser = payload.member?.user || payload.user || UserStore?.getUser(reactorId);
    const finalAuthor = reactorUser || {
      id: reactorId,
      username: payload.member?.nick || "Someone",
      globalName: payload.member?.nick || "Someone",
      avatar: null,
    };

    const reactorName = finalAuthor.globalName || finalAuthor.username || "Someone";
    const emojiName = payload.emoji?.name || "an emoji";

    const newNotification: NotificationItem = {
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
    };

    memoryNotifications = [newNotification, ...memoryNotifications];
    syncStorageDebounced();
  } catch (err) {
    console.error("[BetterInbox] Reaction error:", err);
  }
}

export default {
  onLoad: () => {
    console.log("[BetterInbox] Loaded with fast-exit MESSAGE_CREATE filter");

    if (!pluginStorage.notifications) {
      pluginStorage.notifications = [];
    }
    memoryNotifications = [...pluginStorage.notifications];

    // 1. Listen for incoming messages using the fast-exit filter
    FluxDispatcher.subscribe("MESSAGE_CREATE", handleIncomingMessage);

    // 2. Listen for reactions on your messages
    FluxDispatcher.subscribe("MESSAGE_REACTION_ADD", handleReactionAdd);

    try {
      unpatches.push(patchYouBar());
    } catch (err) {
      console.error("[BetterInbox] YouBar patch error:", err);
    }
  },

  onUnload: () => {
    console.log("[BetterInbox] Unloaded");

    if (saveTimeout) clearTimeout(saveTimeout);
    pluginStorage.notifications = memoryNotifications.slice(0, 100);

    FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleIncomingMessage);
    FluxDispatcher.unsubscribe("MESSAGE_REACTION_ADD", handleReactionAdd);

    for (const unpatch of unpatches) {
      unpatch?.();
    }
    unpatches.length = 0;
  },

  settings: NotificationCenterUI,
};
