import { React, ReactNative as RN } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";

const { ScrollView } = findByProps("ScrollView");
const { TableRowGroup, TableRow, Stack, TextInput, TableSwitchRow } = findByProps(
  "TableSwitchRow",
  "TableCheckboxRow",
  "TableRowGroup",
  "Stack",
  "TableRow"
);

// Default settings
storage.rowPosition ??= 0;
storage.alwaysTop ??= false;

export default function Settings() {
  useProxy(storage);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const [positionInput, setPositionInput] = React.useState(String(storage.rowPosition));

  const updateRowPosition = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 0) {
      storage.rowPosition = num;
      setPositionInput(value);
      forceUpdate();
    } else if (value === "") {
      setPositionInput("");
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
      <Stack spacing={8}>
        <TableRowGroup title="Copy User ID">
          <TableRow
            label="What is this?"
            subLabel="Adds a 'Copy User ID' button to message long-press menu"
          />
        </TableRowGroup>

        <TableRowGroup title="Button Position">
          <TableRow
            label="Row Position"
            subLabel="0 = top, higher numbers = lower in the list"
            trailing={
              <TextInput
                placeholder="0"
                value={positionInput}
                onChange={updateRowPosition}
                isClearable
                returnKeyType="done"
                keyboardType="numeric"
                style={{ width: 60, textAlign: "right" }}
              />
            }
          />
          <TableSwitchRow
            label="Always at Top"
            subLabel="Override position and keep at top"
            value={storage.alwaysTop ?? false}
            onValueChange={() => {
              storage.alwaysTop = !storage.alwaysTop;
              forceUpdate();
            }}
          />
        </TableRowGroup>
      </Stack>
    </ScrollView>
  );
}