import { findByName } from "@vendetta/metro";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";

const UserProfileCard = findByName("UserProfileCard") || findByName("UserProfileSection");

export default function PermissionViewer({ userId, guildId }: { userId: string; guildId: string }) {
    const styles = stylesheet.createThemedStyleSheet({
        card: {
            backgroundColor: semanticColors.BACKGROUND_MOD_MUTED,
            borderColor: "rgb(255, 0, 0)", // Hard bright red border so it screams "I AM WORKING!"
            borderWidth: 2,
            borderRadius: 10,
            padding: 12,
            marginTop: 8,
        },
        title: {
            color: semanticColors.TEXT_DEFAULT,
            fontWeight: "bold",
        }
    });

    // Hard-coded visual test block
    if (UserProfileCard) {
        return (
            <RN.View style={styles.card}>
                <RN.Text style={styles.title}>🚨 Injection Test Successful! (User: {userId})</RN.Text>
            </RN.View>
        );
    }

    return null;
}
