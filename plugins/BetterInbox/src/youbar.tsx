import { findByTypeName, findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import NotificationCenterUI from "./components/NotificationCenterUI";

const tabsNavigationRef = findByProps("getRootNavigationRef");

export function patchYouBar() {
  const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");

  if (!YouBarNotificationsButton) {
    console.warn("[BetterInbox] YouBarNotificationsButton component not found");
    return () => {};
  }

  return instead("type", YouBarNotificationsButton, (args, OriginalRender) => {
    const res = OriginalRender(...args);

    const pressableNode = findInReactTree(res, (node) => typeof node?.props?.onPress === "function");

    if (pressableNode) {
      pressableNode.props.onPress = () => {
        console.log("[BetterInbox] Intercepted YouBar click!");

        const navigation = tabsNavigationRef?.getRootNavigationRef?.();
        if (navigation?.navigate) {
          navigation.navigate("VendettaCustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(NotificationCenterUI),
          });
        }
      };
    }

    return res;
  });
}
