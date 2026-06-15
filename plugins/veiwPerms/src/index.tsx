// Permission Viewer Plugin for Revenge/Bunny
import { findByStoreName, findByProps, findAllExports } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";

const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const ChannelStore = findByStoreName("ChannelStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");
const SelectedGuildStore = findByStoreName("SelectedGuildStore") || findByProps("getGuildId");

// Resolve core permission utility structures securely
const PermsModule = findAllExports(
    m => typeof m?.computePermissions === "function" &&
         typeof m?.can === "function" &&
         typeof m?.computePermissionsForRoles === "function"
)?.[0] || findByProps("computePermissions", "can", "computePermissionsForRoles");

const PermConstants = findByProps("Permissions")?.Permissions;

// Fallback lookup labels
const DEFAULT_LABELS_MAP = {
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

/**
 * Iterates through active permissions maps by resolving dynamic structural constants safely
 */
function getUserPermissions(guildId, userId) {
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
        
        const activePermissions = [];
        const bigIntMap = BigInt(permsBigInt);
        const isAdmin = PermConstants?.ADMINISTRATOR ? (bigIntMap & BigInt(PermConstants.ADMINISTRATOR)) !== 0n : false;
        
        // Loop through our core labels layout configuration safely
        for (const [apiKey, readableName] of Object.entries(DEFAULT_LABELS_MAP)) {
            const flagValue = PermConstants?.[apiKey];
            if (flagValue) {
                const hasPerm = (bigIntMap & BigInt(flagValue)) !== 0n;
                if (isAdmin || hasPerm) {
                    activePermissions.push(readableName);
                }
            }
        }
        
        return [...new Set(activePermissions)];
    } catch (e) {
        console.error("[PermViewer] Error resolving mask calculations:", e);
        return [];
    }
}

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
            style: { maxHeight: 150 },
            nestedScrollEnabled: true
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
        console.log("[PermViewer] Loading target hooks...");
        
        // Find profile configuration modules via standard export types
        const ProfileModule = findByProps("UserProfileModal", "UserProfile") || findByProps("UserProfileBody");
        const UserProfileComponent = ProfileModule?.UserProfile || ProfileModule?.default;
        
        if (UserProfileComponent) {
            // Changed from before to after to safely grab the native child tree structure
            const unpatch = after("render", UserProfileComponent, ([props], responseTree) => {
                if (!props?.userId || !responseTree) return responseTree;
                
                const guildId = SelectedGuildStore?.getGuildId?.();
                if (!guildId) return responseTree;
                
                // Traverse down the React tree array layout looking for your view container
                const bodyContainer = findInReactTree(responseTree, c => 
                    c?.props?.children && Array.isArray(c.props.children)
                );
                
                if (bodyContainer?.props?.children) {
                    bodyContainer.props.children.push(
                        React.createElement(PermissionsSection, { userId: props.userId, guildId })
                    );
                }
                
                return responseTree;
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
