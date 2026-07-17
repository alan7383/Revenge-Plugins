import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";

const { ScrollView } = findByProps("ScrollView");
const { TableRowGroup, TableRow, Stack, TextInput } = findByProps(
  "TableSwitchRow",
  "TableCheckboxRow",
  "TableRowGroup",
  "Stack",
  "TableRow"
);

export default function Settings() {
  useProxy(storage);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const [newChannelId, setNewChannelId] = React.useState("");
  const [newGuildId, setNewGuildId] = React.useState("");
  const [newUserId, setNewUserId] = React.useState("");
  const [newWhitelistId, setNewWhitelistId] = React.useState("");

  // Ensure storage structures exist safely
  storage.hiddenChannelIds ??= [];
  storage.hiddenGuildIds ??= [];
  storage.hiddenUserIds ??= [];
  storage.whitelistedUserIds ??= [];
  storage.whitelistedMentionChannels ??= {};

  const addItem = (id: string, type: "channel" | "guild" | "user" | "whitelist") => {
    const cleanId = id.trim();
    if (!cleanId) {
      showToast(`Please enter a ${type} ID`, getAssetIDByName("Small"));
      return;
    }

    let targetList: "hiddenChannelIds" | "hiddenGuildIds" | "hiddenUserIds" | "whitelistedUserIds";
    if (type === "channel") targetList = "hiddenChannelIds";
    else if (type === "guild") targetList = "hiddenGuildIds";
    else if (type === "user") targetList = "hiddenUserIds";
    else targetList = "whitelistedUserIds";

    if (!storage[targetList].includes(cleanId)) {
      storage[targetList] = [...storage[targetList], cleanId];
      
      if (type === "channel") setNewChannelId("");
      else if (type === "guild") setNewGuildId("");
      else if (type === "user") setNewUserId("");
      else setNewWhitelistId("");

      forceUpdate();
      
      let label = "Channel ID hidden!";
      if (type === "guild") label = "Server ID hidden!";
      if (type === "user") label = "User pings blocked!";
      if (type === "whitelist") label = "User whitelisted!";
      
      showToast(label, getAssetIDByName("Check"));
    } else {
      showToast("ID already exists in list", getAssetIDByName("Warning"));
    }
  };

  const removeItem = (id: string, type: "channel" | "guild" | "user" | "whitelist") => {
    let targetList: "hiddenChannelIds" | "hiddenGuildIds" | "hiddenUserIds" | "whitelistedUserIds";
    if (type === "channel") targetList = "hiddenChannelIds";
    else if (type === "guild") targetList = "hiddenGuildIds";
    else if (type === "user") targetList = "hiddenUserIds";
    else targetList = "whitelistedUserIds";

    storage[targetList] = storage[targetList].filter((item: string) => item !== id);
    forceUpdate();
    showToast("ID removed", getAssetIDByName("Check"));
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
      <Stack spacing={12}>

        {/* --- SECTION: CHANNEL MENTION SHIELD --- */}
        <TableRowGroup title="Hide Channel Mention Counts">
          <Stack spacing={4}>
            <TextInput
              placeholder="Enter Channel ID"
              value={newChannelId}
              onChange={setNewChannelId}
              isClearable
              onSubmitEditing={() => addItem(newChannelId, "channel")}
              returnKeyType="done"
            />
            <TableRow
              label="Add Channel ID"
              trailing={<TableRow.Arrow />}
              onPress={() => addItem(newChannelId, "channel")}
            />
          </Stack>
        </TableRowGroup>

        {storage.hiddenChannelIds.length > 0 && (
          <TableRowGroup title="Hidden Channels">
            {storage.hiddenChannelIds.map((id: string, index: number) => (
              <TableRow
                key={index}
                label={id}
                trailing={
                  <RN.TouchableOpacity onPress={() => removeItem(id, "channel")}>
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

        {/* --- SECTION: SERVER MENTION SHIELD --- */}
        <TableRowGroup title="Hide Server Mention Counts">
          <Stack spacing={4}>
            <TextInput
              placeholder="Enter Server ID"
              value={newGuildId}
              onChange={setNewGuildId}
              isClearable
              onSubmitEditing={() => addItem(newGuildId, "guild")}
              returnKeyType="done"
            />
            <TableRow
              label="Add Server ID"
              trailing={<TableRow.Arrow />}
              onPress={() => addItem(newGuildId, "guild")}
            />
          </Stack>
        </TableRowGroup>

        {storage.hiddenGuildIds.length > 0 && (
          <TableRowGroup title="Hidden Servers">
            {storage.hiddenGuildIds.map((id: string, index: number) => (
              <TableRow
                key={index}
                label={id}
                trailing={
                  <RN.TouchableOpacity onPress={() => removeItem(id, "guild")}>
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

        {/* --- SECTION: USER MENTION BLOCKER --- */}
        <TableRowGroup title="Block Mentions From Specific Users">
          <Stack spacing={4}>
            <TextInput
              placeholder="Enter User ID"
              value={newUserId}
              onChange={setNewUserId}
              isClearable
              onSubmitEditing={() => addItem(newUserId, "user")}
              returnKeyType="done"
            />
            <TableRow
              label="Add User ID"
              trailing={<TableRow.Arrow />}
              onPress={() => addItem(newUserId, "user")}
            />
          </Stack>
        </TableRowGroup>

        {storage.hiddenUserIds.length > 0 && (
          <TableRowGroup title="Blocked Users">
            {storage.hiddenUserIds.map((id: string, index: number) => (
              <TableRow
                key={index}
                label={id}
                trailing={
                  <RN.TouchableOpacity onPress={() => removeItem(id, "user")}>
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

        {/* --- SECTION: WHITELIST USERS --- */}
        <TableRowGroup title="Whitelist Users">
          <Stack spacing={4}>
            <TextInput
              placeholder="Enter User ID"
              value={newWhitelistId}
              onChange={setNewWhitelistId}
              isClearable
              onSubmitEditing={() => addItem(newWhitelistId, "whitelist")}
              returnKeyType="done"
            />
            <TableRow
              label="Add Whitelisted User"
              trailing={<TableRow.Arrow />}
              onPress={() => addItem(newWhitelistId, "whitelist")}
            />
          </Stack>
        </TableRowGroup>

        {storage.whitelistedUserIds.length > 0 && (
          <TableRowGroup title="Whitelisted Users">
            {storage.whitelistedUserIds.map((id: string, index: number) => (
              <TableRow
                key={index}
                label={id}
                trailing={
                  <RN.TouchableOpacity onPress={() => removeItem(id, "whitelist")}>
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

        {/* --- INSTRUCTIONS --- */}
        <TableRowGroup title="Quick Guide">
          <TableRow
            label="How to get IDs?"
            subLabel="Enable Developer Mode in Discord Settings → Advanced. Then long press a server, channel, or user profile and choose Copy ID."
          />
        </TableRowGroup>

      </Stack>
    </ScrollView>
  );
}
