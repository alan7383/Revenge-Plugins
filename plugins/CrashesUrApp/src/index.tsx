import { before, after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import { findByName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import RawPage from "./RawPage";

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const Navigation = findByProps("push", "pushLazy", "pop");
const modalCloseButton =
  findByProps("getRenderCloseButton")?.getRenderCloseButton ??
  findByProps("getHeaderCloseButton")?.getHeaderCloseButton;
const Navigator =
  findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
const { FormRow, FormIcon } = Forms;

const unpatch = before("openLazy", LazyActionSheet, ([component, key, msg]) => {
  // Add null check for msg
  if (!msg) return;

  const message = msg?.message;
  if (key !== "MessageLongPressActionSheet" || !message) return;

  component.then((instance) => {
    const unpatch = after("default", instance, (_, component) => {
      React.useEffect(
        () => () => {
          unpatch();
        },
        [],
      );

      const navigator = () => (
        <Navigator
          initialRouteName="RawPage"
          goBackOnBackPress
          screens={{
            RawPage: {
              title: "ViewRaw",
              headerLeft: modalCloseButton?.(() => Navigation.pop()),
              render: () => <RawPage message={message} />,
            },
          }}
        />
      );

      // Find existing buttons or action sheet groups
      const actionSheetContainer = findInReactTree(
        component,
        (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
      );
      const buttons = findInReactTree(
        component,
        (x) => x?.[0]?.type?.name === "ButtonRow",
      );

      // Case 1: Found ButtonRow - push to end
      if (buttons?.push) {
        buttons.push(
          <FormRow
            label="View Raw"
            leading={
              <FormIcon
                style={{ opacity: 1 }}
                source={getAssetIDByName("ic_chat_bubble_16px")}
              />
            }
            onPress={() => {
              LazyActionSheet.hideActionSheet();
              Navigation.push(navigator);
            }}
          />
        );
        return;
      }

      // Case 2: Found ActionSheetRowGroup with children - use optional chaining
      if (actionSheetContainer?.[1]?.props?.children?.[0]?.props?.icon) {
        const middleGroup = actionSheetContainer[1];
        const firstChild = middleGroup.props.children[0];
        const ActionSheetRow = firstChild.type;

        const viewRawButton = (
          <ActionSheetRow
            label="View Raw"
            icon={{
              $$typeof: firstChild.props.icon.$$typeof,
              type: firstChild.props.icon.type,
              key: null,
              ref: null,
              props: {
                IconComponent: () => (
                  <FormIcon
                    style={{ opacity: 1 }}
                    source={getAssetIDByName("ic_chat_bubble_32px")}
                  />
                ),
              },
            }}
            onPress={() => {
              LazyActionSheet.hideActionSheet();
              Navigation.push(navigator);
            }}
            key="view-raw"
          />
        );

        // Safely push using optional chaining
        if (middleGroup.props.children?.push) {
          middleGroup.props.children.push(viewRawButton);
        }
        return;
      }

      // Case 3: No groups found - just log and skip
      console.log("[ViewRaw] Could not find ActionSheet - skipping");
    });
  });
});

export const onUnload = () => unpatch();