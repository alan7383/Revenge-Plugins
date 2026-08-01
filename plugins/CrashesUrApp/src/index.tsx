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

      // Add null checks for findInReactTree results
      const actionSheetContainer = findInReactTree(
        component,
        (x) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
      );
      const buttons = findInReactTree(
        component,
        (x) => x?.[0]?.type?.name === "ButtonRow",
      );

      if (buttons && Array.isArray(buttons)) {
        // Push to end instead of start to put it at bottom
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
          />,
        );
      } else if (actionSheetContainer && actionSheetContainer[1]) {
        const middleGroup = actionSheetContainer[1];
        
        // Add null check for children
        if (!middleGroup?.props?.children) return;
        
        const children = Array.isArray(middleGroup.props.children) 
          ? middleGroup.props.children 
          : [middleGroup.props.children];
        
        const firstChild = children[0];
        if (!firstChild?.props?.icon) return;

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
    
    if (middleGroup.props.children?.push) {
        middleGroup.props.children.push(viewRawButton);
    }
}