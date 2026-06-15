// Permission Viewer Plugin for Revenge/Bunny
import { findByStoreName, findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";

const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const ChannelStore = findByStoreName("ChannelStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const UserStore = findByStoreName("UserStore");

// Get the permissions module (from your discovery)
const PermsModule = bunny?.metro?.findAllExports?.(
    m => typeof m?.computePermissions === "function" &&
         typeof m?.can === "function" &&
         typeof m?.computePermissionsForRoles === "function"
)?.[0] || findByProps("computePermissions", "can", "computePermissionsForRoles");

// Get permission flags
const PermConstants = findByProps("Permissions")?.Permissions;

// Human readable permission names
const PERMISSION_NAMES = {
    [PermConstants?.CREATE_INSTANT_INVITE]: "Create Instant Invite",
    [PermConstants?.KICK_MEMBERS]: "Kick Members",
    [PermConstants?.BAN_MEMBERS]: "Ban Members",
    [PermConstants?.ADMINISTRATOR]: "Administrator 👑",
    [PermConstants?.MANAGE_CHANNELS]: "Manage Channels",
    [PermConstants?.MANAGE_GUILD]: "Manage Server",
    [PermConstants?.ADD_REACTIONS]: "Add Reactions",
    [PermConstants?.VIEW_AUDIT_LOG]: "View Audit Log",
    [PermConstants?.PRIORITY_SPEAKER]: "Priority Speaker",
    [PermConstants?.STREAM]: "Video",
    [PermConstants?.VIEW_CHANNEL]: "View Channel",
    [PermConstants?.SEND_MESSAGES]: "Send Messages",
    [PermConstants?.SEND_TTS_MESSAGES]: "Send TTS Messages",
    [PermConstants?.MANAGE_MESSAGES]: "Manage Messages",
    [PermConstants?.EMBED_LINKS]: "Embed Links",
    [PermConstants?.ATTACH_FILES]: "Attach Files",
    [PermConstants?.READ_MESSAGE_HISTORY]: "Read Message History",
    [PermConstants?.MENTION_EVERYONE]: "Mention @everyone",
    [PermConstants?.USE_EXTERNAL_EMOJIS]: "Use External Emojis",
    [PermConstants?.VIEW_GUILD_INSIGHTS]: "View Guild Insights",
    [PermConstants?.CONNECT]: "Connect",
    [PermConstants?.SPEAK]: "Speak",
    [PermConstants?.MUTE_MEMBERS]: "Mute Members",
    [PermConstants?.DEAFEN_MEMBERS]: "Deafen Members",
    [PermConstants?.MOVE_MEMBERS]: "Move Members",
    [PermConstants?.USE_VAD]: "Use Voice Activity",
    [PermConstants?.CHANGE_NICKNAME]: "Change Nickname",
    [PermConstants?.MANAGE_NICKNAMES]: "Manage Nicknames",
    [PermConstants?.MANAGE_ROLES]: "Manage Roles",
    [PermConstants?.MANAGE_WEBHOOKS]: "Manage Webhooks",
    [PermConstants?.MANAGE_EMOJIS_AND_STICKERS]: "Manage Emojis/Stickers",
    [PermConstants?.USE_APPLICATION_COMMANDS]: "Use Slash Commands",
    [PermConstants?.REQUEST_TO_SPEAK]: "Request to Speak",
    [PermConstants?.MANAGE_EVENTS]: "Manage Events",
    [PermConstants?.MANAGE_THREADS]: "Manage Threads",
    [PermConstants?.CREATE_PUBLIC_THREADS]: "Create Public Threads",
    [PermConstants?.CREATE_PRIVATE_THREADS]: "Create Private Threads",
    [PermConstants?.USE_EXTERNAL_STICKERS]: "Use External Stickers",
    [PermConstants?.SEND_MESSAGES_IN_THREADS]: "Send Messages in Threads",
    [PermConstants?.USE_EMBEDDED_ACTIVITIES]: "Use Activities",
    [PermConstants?.MODERATE_MEMBERS]: "Timeout Members"
};

function getUserPermissions(guildId, userId) {
    try {
        const guild = GuildStore?.getGuild(guildId);
        const member = GuildMemberStore?.getMember(guildId, userId);
        
        if (!guild || !member) return [];
        
        const roles = member.roles || [];
        const channel = ChannelStore?.getChannel(SelectedChannelStore?.getChannelId());
        const overwrites = channel?.permissionOverwrites_ ? Object.values(channel.permissionOverwrites_) : [];
        
        let permsBigInt;
        
        if (PermsModule?.computePermissionsForRoles) {
            permsBigInt = PermsModule.computePermissionsForRoles(roles, overwrites, guild.id);
        } else if (PermsModule?.computePermissions) {
            permsBigInt = PermsModule.computePermissions({ member, guild });
        } else {
            return [];
        }
        
        const permissions = [];
        const isAdmin = (permsBigInt & BigInt(PermConstants?.ADMINISTRATOR || 0x8)) !== 0n;
        
        for (const [bit, name] of Object.entries(PERMISSION_NAMES)) {
            if (bit && (isAdmin || (permsBigInt & BigInt(bit)) !== 0n)) {
                permissions.push(name);
            }
        }
        
        return [...new Set(permissions)];
    } catch (e) {
        console.error("[PermViewer] Error:", e);
        return [];
    }
}

// Component to display permissions
function PermissionsSection({ userId, guildId }) {
    const [permissions, setPermissions] = React.useState([]);
    
    React.useEffect(() => {
        setPermissions(getUserPermissions(guildId, userId));
    }, [userId, guildId]);
    
    if (permissions.length === 0) return null;
    
    return React.createElement("View", {
        style: {
            padding: 12,
            marginTop: 8,
            backgroundColor: "rgba(0,0,0,0.3)",
            borderRadius: 8
        }
    }, [
        React.createElement("Text", {
            style: { color: "#fff", fontWeight: "bold", marginBottom: 8 }
        }, `⚙️ Permissions (${permissions.length})`),
        React.createElement("ScrollView", {
            style: { maxHeight: 150 }
        }, permissions.map(p => 
            React.createElement("Text", {
                key: p,
                style: { color: "#b5bac1", fontSize: 12, marginBottom: 4 }
            }, `• ${p}`)
        ))
    ]);
}

let patches = [];

export default {
    onLoad() {
        console.log("[PermViewer] Loading...");
        
        // Patch the user profile to add permissions section
        const UserProfileComponent = findByProps("UserProfileModal", "UserProfile")?.UserProfile ||
                                      findByProps("default", "render")?.type;
        
        if (UserProfileComponent) {
            const unpatch = before("render", UserProfileComponent, (_, [props]) => {
                if (!props?.userId) return;
                
                const guildId = SelectedChannelStore?.getGuildId();
                if (!guildId) return;
                
                // Find where to inject
                const result = arguments[2]?.();
                if (result) {
                    const body = findInReactTree(result, c => c?.props?.children?.type === "ScrollView");
                    if (body?.props?.children) {
                        body.props.children.push(
                            React.createElement(PermissionsSection, { userId: props.userId, guildId })
                        );
                    }
                }
            });
            patches.push(unpatch);
        }
        
        console.log("[PermViewer] Loaded!");
    },
    
    onUnload() {
        patches.forEach(p => p?.());
        patches = [];
        console.log("[PermViewer] Unloaded!");
    }
};