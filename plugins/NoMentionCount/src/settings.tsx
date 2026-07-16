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

  // Ensure storage structure exists
  storage.hiddenChannelIds ??= [];
  storage.hiddenGuildIds ??= [];

  const addItem = (id: string, type: "channel" | "guild") => {
    const cleanId = id.trim();
    if (!cleanId) {
      showToast(`Please enter a ${type} ID`, getAssetIDByName("Small"));
      return;
    }

    const targetList = type === "channel" ? "hiddenChannelIds" : "hiddenGuildIds";

    if (!storage[targetList].includes(cleanId)) {
      storage[targetList] = [...storage[targetList], cleanId];
      if (type === "channel") setNewChannelId("");
      else setNewGuildId("");
      
      forceUpdate();
      showToast(`${type === "channel" ? "Channel" : "Server"} ID hidden!`, getAssetIDByName("Check"));
    } else {
      showToast("ID already exists in list", getAssetIDByName("Warning"));
    }
  };

  const removeItem = (id: string, type: "channel" | "guild") => {
    const targetList = type === "channel" ? "hiddenChannelIds" : "hiddenGuildIds";
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
              placeholder="Enter Server/Guild ID"
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

        {/* --- INSTRUCTIONS --- */}
        <TableRowGroup title="Quick Guide">
          <TableRow
            label="How to get IDs?"
            subLabel="Go to Discord Settings → Advanced → Turn on Developer Mode. Then, right-click/long-press any channel or server and click 'Copy User/Server/Channel ID'."
          />
        </TableRowGroup>

      </Stack>
    </ScrollView>
  );
}
