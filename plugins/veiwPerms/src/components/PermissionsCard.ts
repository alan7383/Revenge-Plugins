import { findByName, findByStoreName } from "@vendetta/metro";
import { React, ReactNative as RN, stylesheet } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import { getUserPermissions } from "../stuff/permissions";

const SelectedGuildStore = findByStoreName("SelectedGuildStore");

// Lookups matched directly from your reference plugin discovery
const SimplifiedUserProfileCard = findByName("SimplifiedUserProfileCard");
const UserProfileSection = findByName("UserProfileSection");
const UserProfileCard = findByName("UserProfileCard");

export default function PermissionsCard({ userId, variant, style }: { userId: string; variant?: string; style?: any }) {
    const [permissions, setPermissions] = React.useState<string[]>([]);
    const guildId = SelectedGuildStore?.getGuildId();

    React.useEffect(() => {
        if (guildId && userId) {
            setPermissions(getUserPermissions(guildId, userId));
        }
    }, [userId, guildId]);

    if (!guildId || permissions.length === 0) return null;

    const styles = stylesheet.createThemedStyleSheet({
        wrapper: {
            padding: 12,
            backgroundColor: semanticColors.CARD_SECONDARY_BG || "rgba(0,0,0,0.2)",
            borderRadius: 8,
            marginTop: 8,
        },
        title: {
            color: semanticColors.TEXT_NORMAL || "#ffffff",
            fontWeight: "bold",
            fontSize: 14,
            marginBottom: 6,
        },
        item: {
            color: semanticColors.TEXT_MUTED || "#b5bac1",
            fontSize: 13,
            marginVertical: 2,
        }
    });

    const content = React.createElement(RN.View, { style: styles.wrapper }, [
        React.createElement(RN.Text, { style: styles.title }, `⚙️ Server Permissions (${permissions.length})`),
        React.createElement(RN.ScrollView, { style: { maxHeight: 160 }, nestedScrollEnabled: true }, 
            permissions.map(p => React.createElement(RN.Text, { key: p, style: styles.item }, `• ${p}`))
        )
    ]);

    // Handle structural rendering forks dynamically based on app lifecycle build context
    if ((variant === "simplified" || variant === "you") && SimplifiedUserProfileCard) {
        return React.createElement(SimplifiedUserProfileCard, { title: "Permissions Engine", style }, content);
    }
    if (UserProfileCard) {
        return React.createElement(UserProfileCard, { title: "Permissions Engine", style }, content);
    }
    if (UserProfileSection) {
        return React.createElement(UserProfileSection, { title: "Permissions Engine" }, content);
    }

    return content;
}
