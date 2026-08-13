import { findByProps, findByTypeName, findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import NotificationCenterUI from "./components/NotificationCenterUI";

const Navigation = findByProps("push", "pushLazy", "pop");
const Navigator = findByName("Navigator") ?? findByProps("Navigator")?.Navigator;
const modalCloseButton =
  findByProps("getRenderCloseButton")?.getRenderCloseButton ??
  findByProps("getHeaderCloseButton")?.getHeaderCloseButton;

export function patchYouBar(): (() => void) | null {
  const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");

  if (!YouBarNotificationsButton) {
    return null;
  }

  const BellIcon = getAssetIDByName("BellIcon") || getAssetIDByName("NotificationBellIcon");

  return instead("type", YouBarNotificationsButton, (args, OriginalRender) => {
    const res = OriginalRender(...args);

    if (!res?.props?.children) return res;

    const IconButton = res.props.children.type;
    const originalProps = res.props.children.props;

    const openInboxNavigator = () => {
      console.log("[BetterInbox] Launching native Navigator modal...");

      const InboxModal = () => (
        <Navigator
          initialRouteName="BetterInboxPage"
          goBackOnBackPress
          screens={{
            BetterInboxPage: {
              title: "Better Inbox",
              headerLeft: modalCloseButton?.(() => Navigation?.pop?.()),
              render: () => <NotificationCenterUI />,
            },
          }}
        />
      );

      if (typeof Navigation?.push === "function") {
        Navigation.push(InboxModal);
      } else {
        console.error("[BetterInbox] Navigation.push module not available");
      }
    };

    if (!IconButton) return res;

    return (
      <IconButton
        variant={originalProps?.variant || "tertiary"}
        size={originalProps?.size || "sm"}
        icon={BellIcon || originalProps?.icon}
        onPress={openInboxNavigator}
      />
    );
  });
}
