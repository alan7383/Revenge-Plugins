import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";

const GuildStore = findByStoreName("GuildStore");
const SelectedGuildStore = findByStoreName("SelectedGuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const PermissionUtils = findByProps("getGuildPermissionProps", "computePermissions");

// Locate the section container object we discovered via eval
const UserProfileSection = findByName("UserProfileSection", false);

const styles = stylesheet.createThemedStyleSheet({
    permContainer: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: semanticColors.BACKGROUND_SECONDARY,
    },
    permHeader: {
        fontSize: 12,
        fontWeight: "bold",
        color: semanticColors.TEXT_MUTED,
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    permBadge: {
        width: "48%", // Two-column grid layout
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 4,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    allowedDot: {
        backgroundColor: "#23a55a", // Discord Green
    },
    deniedDot: {
        backgroundColor: "#f23f43", // Discord Red
    },
    permName: {
        fontSize: 13,
        color: semanticColors.TEXT_NORMAL,
    }
});

const READABLE_PERMISSIONS: Record<string, string> = {
    "ADMINISTRATOR": "Administrator",
    "MANAGE_GUILD": "Manage Server",
    "MANAGE_ROLES": "Manage Roles",
    "MANAGE_CHANNELS": "Manage Channels",
    "KICK_MEMBERS": "Kick Members",
    "BAN_MEMBERS": "Ban Members",
    "MANAGE_MESSAGES": "Manage Messages",
    "MANAGE_NICKNAMES": "Manage Nicknames",
    "MANAGE_WEBHOOKS": "Manage Webhooks",
    "MANAGE_EMOJIS_AND_STICKERS": "Manage Emojis",
    "VIEW_AUDIT_LOG": "View Audit Log",
    "MENTION_EVERYONE": "Mention Everyone",
};

function computeGuildPermissions(guildId: string, userId: string) {
    const guild = GuildStore.getGuild(guildId);
    if (!guild) return null;

    const memberPermissions = PermissionUtils.computePermissions({
        member: GuildMemberStore.getMember(guildId, userId),
        guild: guild
    });

    const flagConstants = PermissionUtils.Permissions; 
    const calculatedSheet: Record<string, boolean> = {};

    for (const key of Object.keys(READABLE_PERMISSIONS)) {
        const bitmaskValue = flagConstants[key];
        if (bitmaskValue) {
            const hasPerm = (BigInt(memberPermissions) & BigInt(bitmaskValue)) !== 0n;
            const isAdmin = (BigInt(memberPermissions) & BigInt(flagConstants.ADMINISTRATOR)) !== 0n;
            calculatedSheet[key] = hasPerm || isAdmin;
        }
    }

    return calculatedSheet;
}

/**
 * Clean inline layout component that displays permissions as a 2-column grid
 */
function InlinePermissionsGrid({ userId }: { userId: string }) {
    const activeGuildId = SelectedGuildStore.getGuildId();
    if (!activeGuildId) return null;

    const permissions = computeGuildPermissions(activeGuildId, userId);
    if (!permissions) return null;

    return (
        <RN.View style={styles.permContainer}>
            <RN.Text style={styles.permHeader}>Server Permissions</RN.Text>
            <RN.View style={styles.grid}>
                {Object.entries(READABLE_PERMISSIONS).map(([apiKey, readableLabel]) => {
                    const isAllowed = permissions[apiKey] ?? false;
                    return (
                        <RN.View style={styles.permBadge} key={apiKey}>
                            <RN.View style={[styles.indicator, isAllowed ? styles.allowedDot : styles.deniedDot]} />
                            <RN.Text style={styles.permName} numberOfLines={1}>{readableLabel}</RN.Text>
                        </RN.View>
                    );
                })}
            </RN.View>
        </RN.View>
    );
}

let unpatchProfileSection: (() => void) | null = null;

export default {
    onLoad() {
        if (!UserProfileSection) return;

        // Determine if we patch the object directly or its underlying React render function
        const targetComponent = typeof UserProfileSection === "object" && (UserProfileSection as any).render 
            ? (UserProfileSection as any) 
            : UserProfileSection;

        const methodToPatch = typeof UserProfileSection === "object" && (UserProfileSection as any).render 
            ? "render" 
            : "default";

        unpatchProfileSection = after(methodToPatch as any, targetComponent, (args: any, res: any) => {
            // Grab props from the current section execution instance
            const props = args[0];
            if (!props) return res;

            // Normalize the section identifier (handles string titles or structured config objects)
            const sectionTitle = typeof props.title === "string" 
                ? props.title.toUpperCase() 
                : props.title?.string?.toUpperCase() || "";

            // Check if this specific section instance is rendering the Roles layout
            if (sectionTitle.includes("ROLE") && props.userId) {
                // Return original layout but inject our inline grid right below it inside a Fragment container
                return React.createElement(
                    React.Fragment,
                    null,
                    res,
                    React.createElement(InlinePermissionsGrid, { userId: props.userId })
                );
            }

            return res;
        });
    },

    onUnload() {
        unpatchProfileSection?.();
        unpatchProfileSection = null;
    }
};
