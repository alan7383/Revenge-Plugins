import { React, ReactNative as RN } from "@metro/common";
import { storage } from "@vendetta/plugin";
import { showToast } from "@ui/toasts";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@ui/assets";
import { findByProps } from "@metro";

const { ScrollView } = findByProps("ScrollView");
const { TableRowGroup, TableRow, Stack, TextInput, TableSwitchRow } = findByProps(
    "TableSwitchRow",
    "TableCheckboxRow",
    "TableRowGroup",
    "Stack",
    "TableRow"
);

// Initialize storage
storage.hiddenChannels ??= [];
storage.hiddenGuilds ??= [];

export default function Settings() {
    useProxy(storage);
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
    
    const [newChannelId, setNewChannelId] = React.useState("");
    const [newGuildId, setNewGuildId] = React.useState("");

    const addChannelId = () => {
        if (!newChannelId.trim()) {
            showToast("Please enter a channel ID", getAssetIDByName("Small"));
            return;
        }
        if (!storage.hiddenChannels.includes(newChannelId.trim())) {
            storage.hiddenChannels = [...storage.hiddenChannels, newChannelId.trim()];
            setNewChannelId("");
            forceUpdate();
            showToast("Channel ID added", getAssetIDByName("Check"));
        } else {
            showToast("Channel ID already exists", getAssetIDByName("Warning"));
        }
    };

    const removeChannelId = (channelId: string) => {
        storage.hiddenChannels = storage.hiddenChannels.filter((id: string) => id !== channelId);
        forceUpdate();
        showToast("Channel ID removed", getAssetIDByName("Check"));
    };

    const addGuildId = () => {
        if (!newGuildId.trim()) {
            showToast("Please enter a server ID", getAssetIDByName("Small"));
            return;
        }
        if (!storage.hiddenGuilds.includes(newGuildId.trim())) {
            storage.hiddenGuilds = [...storage.hiddenGuilds, newGuildId.trim()];
            setNewGuildId("");
            forceUpdate();
            showToast("Server ID added", getAssetIDByName("Check"));
        } else {
            showToast("Server ID already exists", getAssetIDByName("Warning"));
        }
    };

    const removeGuildId = (guildId: string) => {
        storage.hiddenGuilds = storage.hiddenGuilds.filter((id: string) => id !== guildId);
        forceUpdate();
        showToast("Server ID removed", getAssetIDByName("Check"));
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
            <Stack spacing={8}>
                <TableRowGroup title="Mention Count Hider">
                    <TableRow
                        label="What is this?"
                        subLabel="Hide mention counts (pings) for selected channels and servers"
                    />
                </TableRowGroup>

                {/* Channel Section */}
                <TableRowGroup title="Add Channel ID">
                    <Stack spacing={4}>
                        <TextInput
                            placeholder="Enter channel ID"
                            value={newChannelId}
                            onChange={setNewChannelId}
                            isClearable
                            onSubmitEditing={addChannelId}
                            returnKeyType="done"
                        />
                    </Stack>
                </TableRowGroup>

                <TableRowGroup>
                    <TableRow
                        label="Add Channel ID"
                        subLabel="Hide mention counts in this channel"
                        trailing={<TableRow.Arrow />}
                        onPress={addChannelId}
                    />
                </TableRowGroup>

                {storage.hiddenChannels && storage.hiddenChannels.length > 0 && (
                    <TableRowGroup title="Hidden Channels">
                        {storage.hiddenChannels.map((channelId: string, index: number) => (
                            <TableRow
                                key={index}
                                label={channelId}
                                trailing={
                                    <RN.TouchableOpacity onPress={() => removeChannelId(channelId)}>
                                        <RN.Image
                                            source={getAssetIDByName("TrashIcon")}
                                            style={{ width: 20, height: 20, tintColor: "#ff4d4d" }}
                                        />
                                    </RN.TouchableOpacity>
                                }
                            />
                        ))}
                    </TableRowGroup>
                )}

                {/* Guild Section */}
                <TableRowGroup title="Add Server ID">
                    <Stack spacing={4}>
                        <TextInput
                            placeholder="Enter server ID"
                            value={newGuildId}
                            onChange={setNewGuildId}
                            isClearable
                            onSubmitEditing={addGuildId}
                            returnKeyType="done"
                        />
                    </Stack>
                </TableRowGroup>

                <TableRowGroup>
                    <TableRow
                        label="Add Server ID"
                        subLabel="Hide mention counts in ALL channels of this server"
                        trailing={<TableRow.Arrow />}
                        onPress={addGuildId}
                    />
                </TableRowGroup>

                {storage.hiddenGuilds && storage.hiddenGuilds.length > 0 && (
                    <TableRowGroup title="Hidden Servers">
                        {storage.hiddenGuilds.map((guildId: string, index: number) => (
                            <TableRow
                                key={index}
                                label={guildId}
                                trailing={
                                    <RN.TouchableOpacity onPress={() => removeGuildId(guildId)}>
                                        <RN.Image
                                            source={getAssetIDByName("TrashIcon")}
                                            style={{ width: 20, height: 20, tintColor: "#ff4d4d" }}
                                        />
                                    </RN.TouchableOpacity>
                                }
                            />
                        ))}
                    </TableRowGroup>
                )}

                <TableRowGroup title="How to Get IDs">
                    <TableRow
                        label="Channel ID"
                        subLabel="Enable Developer Mode → right-click channel → Copy ID"
                    />
                    <TableRow
                        label="Server ID"
                        subLabel="Enable Developer Mode → right-click server name → Copy ID"
                    />
                </TableRowGroup>
            </Stack>
        </ScrollView>
    );
}
