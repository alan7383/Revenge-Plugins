import { patcher } from "@vendetta/patcher";
import { findByProps, findByStore } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms, General } from "@vendetta/ui/components";
import { showSimpleActionSheet } from "@vendetta/ui/actionSheets";

let unpatch: (() => void) | undefined;

export default {
    onLoad: () => {
        try {
            // Safe module resolution with fallbacks
            const GuildStore = findByStore("GuildStore");
            const GuildContextMenu = 
                findByProps("GuildContextMenu") ?? 
                findByProps("GuildContextMenuHeader") ?? 
                findByProps("default", "GuildContextMenu");

            if (!GuildContextMenu) {
                console.error("[ServerInfo] GuildContextMenu module not found.");
                return;
            }

            // Patch the menu securely
            unpatch = patcher.after("default", GuildContextMenu, ([{ guild }], res) => {
                if (!guild || !res?.props?.children) return;

                const FormRow = Forms?.FormRow ?? Forms?.FormItem;
                if (!FormRow) return;

                res.props.children.push(
                    React.createElement(FormRow, {
                        label: "Server Info",
                        leading: General?.Icon ? <General.Icon name="ic_information_24px" /> : null,
                        onPress: () => {
                            const targetGuild = GuildStore?.getGuild?.(guild.id);
                            const memberCount = targetGuild?.memberCount ?? "Unknown";
                            const ownerId = targetGuild?.ownerId ?? "Unknown";
                            
                            // Snowflake creation timestamp
                            const createdDate = new Date(
                                Number(BigInt(guild.id) >> 22n) + 1420070400000
                            ).toLocaleDateString();

                            showSimpleActionSheet({
                                key: "ServerInfoActionSheet",
                                header: {
                                    title: targetGuild?.name ?? guild.name ?? "Server Info",
                                    subtitle: `ID: ${guild.id}`,
                                    icon: targetGuild?.getIconURL?.(),
                                },
                                options: [
                                    { label: `Members: ${memberCount}`, isSecondary: true },
                                    { label: `Created: ${createdDate}`, isSecondary: true },
                                    { label: `Owner ID: ${ownerId}`, isSecondary: true },
                                ],
                            });
                        },
                    })
                );
            });
        } catch (err) {
            console.error("[ServerInfo] Error during onLoad:", err);
        }
    },

    onUnload: () => {
        unpatch?.();
    },
};
