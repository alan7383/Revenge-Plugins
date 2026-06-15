import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { semanticColors } from "@vendetta/ui";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

const GuildStore = findByStoreName("GuildStore");
const SelectedGuildStore = findByStoreName("SelectedGuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const PermissionUtils = findByProps("getGuildPermissionProps", "computePermissions");

// Updated to target your exact asset dump index names
const ShieldIcon = getAssetIDByName("ic_person_shield") ?? 
                    getAssetIDByName("ic_shield_24px") ?? 
                    getAssetIDByName("safety_shield");

const styles = stylesheet.createThemedStyleSheet({
    scrollWindow: {
        marginVertical: 10,
        maxHeight: RN.Dimensions.get("window").height * 0.45,
    },
    permRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: semanticColors.BACKGROUND_MODIFIER_ACCENT,
    },
    permName: {
        fontSize: 15,
        fontWeight: "500",
        color: semanticColors.TEXT_NORMAL,
    },
    allowedText: {
        color: "#23a55a", 
        fontWeight: "bold",
    },
    deniedText: {
        color: "#f23f43", 
        fontWeight: "bold",
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
    "MANAGE_EMOJIS_AND_STICKERS": "Manage Emojis/Stickers",
    "VIEW_AUDIT_LOG": "View Audit Log",
    "MENTION_EVERYONE": "Mention @everyone",
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

function PermissionsListModal({ permissions }: { permissions: Record<string, boolean> }) {
    return (
        <RN.ScrollView style={styles.scrollWindow} nestedScrollEnabled={true}>
            {Object.entries(READABLE_PERMISSIONS).map(([apiKey, readableLabel]) => {
                const isAllowed = permissions[apiKey] ?? false;
                return (
                    <RN.View style={styles.permRow} key={apiKey}>
                        <RN.Text style={styles.permName}>{readableLabel}</RN.Text>
                        <RN.Text style={isAllowed ? styles.allowedText : styles.deniedText}>
                            {isAllowed ? "✔ ALLOWED" : "❌ DENIED"}
                        </RN.Text>
                    </RN.View>
                );
            })}
        </RN.ScrollView>
    );
}

function openPermissionsAlert(userId: string, username: string) {
    const activeGuildId = SelectedGuildStore.getGuildId();
    if (!activeGuildId) return;

    const permissions = computeGuildPermissions(activeGuildId, userId);
    if (!permissions) return;

    const alertOptions = {
        title: `${username}'s Server Permissions`,
        confirmText: "Close",
        onConfirm: () => void 0,
        children: React.createElement(PermissionsListModal, { permissions })
    };

    // @ts-expect-error - children array injects clean native container tree
    showConfirmationAlert(alertOptions);
}

let unpatchUserActionSheet: (() => void) | null = null;

export default {
    onLoad() {
        unpatchUserActionSheet = before("openLazy", ActionSheet, ([comp, args, data]) => {
            if (args !== "UserGenericActionSheet" || !data?.user) return;

            const targetUser = data.user;

            comp.then((instance: any) => {
                const unpatch = after("default", instance, (_: any, component: any) => {
                    React.useEffect(() => () => { unpatch(); }, []);

                    const groups: any[] = findInReactTree(
                        component,
                        (c: any) => Array.isArray(c) && c[0]?.type?.name === "ActionSheetRowGroup"
                    );

                    if (!groups?.length) return;

                    const viewPermsButton = React.createElement(ActionSheetRow, {
                        label: "View Server Permissions",
                        icon: React.createElement(ActionSheetRow.Icon, {
                            source: ShieldIcon,
                        }),
                        onPress: () => {
                            ActionSheet.hideActionSheet();
                            setTimeout(() => {
                                openPermissionsAlert(targetUser.id, targetUser.username);
                            }, 150);
                        },
                    });

                    let inserted = false;
                    for (let gi = 0; gi < groups.length; gi++) {
                        const groupChildren: any[] = findInReactTree(
                            groups[gi],
                            (c: any) => Array.isArray(c) && c.some((child: any) =>
                                child?.type?.name === "ActionSheetRow"
                            )
                        );
                        if (!groupChildren) continue;

                        groupChildren.unshift(viewPermsButton);
                        inserted = true;
                        break;
                    }

                    if (!inserted) {
                        groups.unshift(
                            React.createElement(ActionSheetRow.Group, null, viewPermsButton)
                        );
                    }
                });
            });
        });
    },

    onUnload() {
        unpatchUserActionSheet?.();
        unpatchUserActionSheet = null;
    },
};
