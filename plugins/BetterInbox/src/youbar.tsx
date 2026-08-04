import { findByProps, findByTypeName } from "@revenge-mod/metro";
import { React } from "@revenge-mod/metro/common";
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

    // Grab Discord's native IconButton component and its default props
    const IconButton = res.props.children.type;
    const originalProps = res.props.children.props;

    const openCustomPage = () => {
      console.log("[BetterInbox] Intercepted YouBar click!");
      
      const navigation = tabsNavigationRef?.getRootNavigationRef?.();
      
      // Attempt 1: Standard Vendetta Custom Page route
      if (navigation?.navigate) {
        try {
          navigation.navigate("VendettaCustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(NotificationCenterUI),
          });
          return;
        } catch (err) {
          console.error("[BetterInbox] VendettaCustomPage navigation failed:", err);
        }
      }

      // Fallback Attempt 2: Direct push via Discord's global navigation stack
      const navModule = findByProps("push", "pop");
      if (navModule?.push) {
        navModule.push(NotificationCenterUI, { title: "Better Inbox" });
      }
    };

    // Render ONLY our custom IconButton matching Discord's native dimensions
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
