import { find, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showSimpleActionSheet } from "@vendetta/ui/actionSheets";

let unpatch: (() => void) | undefined;

function patchGuildMenu(): () => void {
    // Locate the exact menu builder function Discord mobile uses
    const mod = find((m: any) => m?.default?.name === "getGuildsBarGuildMenuItems");
    if (!mod?.default) return () => {};

    const GuildStore = findByStoreName("GuildStore");

    return after("default", mod, (args: any[], ret: any) => {
        const guildId = args?.[0];
        if (!guildId || !Array.isArray(ret)) return ret;

        const id = String(guildId);

        const serverInfoItem = {
            label: "Server Info",
            action: () => {
                const targetGuild = GuildStore?.getGuild?.(id);
                const memberCount = targetGuild?.memberCount ?? "Unknown";
                const ownerId = targetGuild?.ownerId ?? "Unknown";

                // Snowflake creation timestamp
                const createdDate = new Date(
                    Number(BigInt(id) >> 22n) + 1420070400000
                ).toLocaleDateString();

                showSimpleActionSheet({
                    key: "ServerInfoActionSheet",
                    header: {
                        title: targetGuild?.name ?? "Server Info",
                        subtitle: `ID: ${id}`,
                        icon: targetGuild?.getIconURL?.(),
                    },
                    options: [
                        { label: `Members: ${memberCount}`, isSecondary: true },
                        { label: `Created: ${createdDate}`, isSecondary: true },
                        { label: `Owner ID: ${ownerId}`, isSecondary: true },
                    ],
                });
            },
        };

        // Append our custom button object to the menu array
        return [...ret, serverInfoItem];
    });
}

export default {
    onLoad: () => {
        try {
            unpatch = patchGuildMenu();
        } catch (error) {
            console.error("[ServerInfo] Failed to apply guildMenu patch:", error);
        }
    },
    onUnload: () => {
        try {
            unpatch?.();
        } catch {
            /* ignore cleanup error */
        }
        unpatch = undefined;
    },
};
