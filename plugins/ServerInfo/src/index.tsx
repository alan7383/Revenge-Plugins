import { patcher, metro } from "@vendetta/patcher";
import { findByProps, findByStore } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms, General } from "@vendetta/ui/components";
import { showSimpleActionSheet } from "@vendetta/ui/actionSheets";

// Fetch required stores & components
const GuildStore = findByStore("GuildStore");
const GuildMemberStore = findByStore("GuildMemberStore");
const { FormRow, FormSection } = Forms;

// Context menu patch target
const GuildContextMenu = findByProps("GuildContextMenu") ?? findByProps("default", "GuildContextMenu");

let unpatch: () => void;

export default {
    onLoad: () => {
        unpatch = patcher.after("default", GuildContextMenu, ([{ guild }], res) => {
            if (!guild) return;

            // Inject "Server Info" button into the context menu
            res.props.children.push(
                React.createElement(FormRow, {
                    label: "Server Info",
                    leading: <General.Icon name="InformationIcon" />,
                    onPress: () => {
                        // Gather server data
                        const targetGuild = GuildStore.getGuild(guild.id);
                        const memberCount = targetGuild?.memberCount ?? "Unknown";
                        const ownerId = targetGuild?.ownerId;
                        const createdDate = new Date(Number(BigInt(guild.id) >> 22n) + 1420070400000).toLocaleDateString();

                        // Open native Action Sheet
                        showSimpleActionSheet({
                            key: "ServerInfoActionSheet",
                            header: {
                                title: targetGuild.name,
                                subtitle: `ID: ${guild.id}`,
                                icon: targetGuild.getIconURL?.(),
                            },
                            options: [
                                {
                                    label: `Members: ${memberCount}`,
                                    isSecondary: true,
                                },
                                {
                                    label: `Created: ${createdDate}`,
                                    isSecondary: true,
                                },
                                {
                                    label: `Owner ID: ${ownerId}`,
                                    isSecondary: true,
                                },
                            ],
                        });
                    },
                })
            );
        });
    },

    onUnload: () => {
        unpatch?.();
    },
};
