import { findByStoreName, findByProps, findAllExports } from "@vendetta/metro";

const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const ChannelStore = findByStoreName("ChannelStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");

const PermsModule = findAllExports(
    m => typeof m?.computePermissions === "function" &&
         typeof m?.can === "function" &&
         typeof m?.computePermissionsForRoles === "function"
)?.[0] || findByProps("computePermissions", "can", "computePermissionsForRoles");

const PermConstants = findByProps("Permissions")?.Permissions;

const LABELS_MAPPING: Record<string, string> = {
    "ADMINISTRATOR": "Administrator 👑",
    "MANAGE_GUILD": "Manage Server",
    "MANAGE_ROLES": "Manage Roles",
    "MANAGE_CHANNELS": "Manage Channels",
    "KICK_MEMBERS": "Kick Members",
    "BAN_MEMBERS": "Ban Members",
    "MANAGE_MESSAGES": "Manage Messages",
    "MANAGE_NICKNAMES": "Manage Nicknames",
    "MANAGE_WEBHOOKS": "Manage Webhooks",
    "MANAGE_EMOJIS_AND_STICKERS": "Manage Emojis/Stickers",
    "VIEW_AUDIT_LOG": "View Audit Log",
    "MENTION_EVERYONE": "Mention @everyone",
    "SEND_MESSAGES": "Send Messages",
    "VIEW_CHANNEL": "View Channel"
};

export function getUserPermissions(guildId: string, userId: string): string[] {
    try {
        const guild = GuildStore?.getGuild(guildId);
        const member = GuildMemberStore?.getMember(guildId, userId);
        if (!guild || !member) return [];

        let permsBigInt;
        if (PermsModule?.computePermissions) {
            permsBigInt = PermsModule.computePermissions({ member, guild });
        } else if (PermsModule?.computePermissionsForRoles && ChannelStore && SelectedChannelStore) {
            const roles = member.roles || [];
            const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
            const overwrites = channel?.permissionOverwrites_ ? Object.values(channel.permissionOverwrites_) : [];
            permsBigInt = PermsModule.computePermissionsForRoles(roles, overwrites, guild.id);
        } else {
            return [];
        }

        const calculatedFlags: string[] = [];
        const bigIntPermissions = BigInt(permsBigInt);
        const isAdmin = PermConstants?.ADMINISTRATOR ? (bigIntPermissions & BigInt(PermConstants.ADMINISTRATOR)) !== 0n : false;

        for (const [key, readableLabel] of Object.entries(LABELS_MAPPING)) {
            const flagValue = PermConstants?.[key];
            if (flagValue) {
                const hasPerm = (bigIntPermissions & BigInt(flagValue)) !== 0n;
                if (hasPerm || isAdmin) {
                    calculatedFlags.push(readableLabel);
                }
            }
        }

        return [...new Set(calculatedFlags)];
    } catch (e) {
        console.error("[PermViewer] Error evaluating permissions bitmask:", e);
        return [];
    }
}
