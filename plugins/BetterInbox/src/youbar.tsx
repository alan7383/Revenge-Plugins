import { findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import NotificationCenterUI from "./components/NotificationCenterUI";

const tabsNavigationRef = findByProps("getRootNavigationRef");

export function patchYouBar() {
  const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");

  if (!YouBarNotificationsButton) {
    console.warn("[BetterInbox] YouBarNotificationsButton component not found");
    return () => {};
  }

  const BellIcon = getAssetIDByName("BellIcon") || getAssetIDByName("NotificationBellIcon");

  return instead("type", YouBarNotificationsButton, (args, OriginalRender) => {
    const res = OriginalRender(...args);

    if (!res?.props?.children) return res;

    // Extract Discord's native IconButton component and its layout props
    const IconButton = res.props.children.type;
    const originalProps = res.props.children.props;

    const openCustomPage = () => {
      console.log("[BetterInbox] Intercepted YouBar click!");

      const navigation = tabsNavigationRef?.getRootNavigationRef?.();

      if (navigation?.navigate) {
        try {
          navigation.navigate("VendettaCustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(NotificationCenterUI),
          });
          return;
        } catch (err) {
          console.error("[BetterInbox] Navigation error:", err);
        }
      }
    };

    // Render native IconButton with custom action
    return (
      <IconButton
        variant={originalProps?.variant || "tertiary"}
        size={originalProps?.size || "sm"}
        icon={BellIcon || originalProps?.icon}
        onPress={openCustomPage}
      />
    );
  });
}
