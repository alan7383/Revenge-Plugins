import { findByName } from "@vendetta/metro";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import { getUserPermissions } from "../stuff/permissions";

const UserProfileCard = findByName("UserProfileCard") || findByName("UserProfileSection");

export default function PermissionViewer({ userId, guildId }: { userId: string; guildId: string }) {
    const styles = stylesheet.createThemedStyleSheet({
        card: {
            backgroundColor: semanticColors.BACKGROUND_MOD_MUTED,
            borderColor: semanticColors.BORDER_MUTED,
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            marginTop: 8,
        },
        title: {
            color: semanticColors.TEXT_DEFAULT,
            fontWeight: "bold",
            marginBottom: 4,
        },
        text: {
            color: semanticColors.TEXT_MUTED,
        }
    });

    if (!guildId || !userId) return null;

    const permissions = getUserPermissions(guildId, userId);
    if (permissions.length === 0) return null;

    if (UserProfileCard) {
        return (
            <RN.View style={styles.card}>
                <RN.Text style={styles.title}>Server Permissions</RN.Text>
                <RN.Text style={styles.text}>{permissions.join(", ")}</RN.Text>
            </RN.View>
        );
    }

    return null;
}
