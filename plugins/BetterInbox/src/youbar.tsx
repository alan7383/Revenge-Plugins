import { findByProps, findByTypeName } from "@vendetta/metro";
import { NavigationNative, React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import NotificationCenterUI from "./components/NotificationCenterUI";

// Retrieve Discord's navigation utilities
const Router = findByProps("push", "pop", "openLazy");
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

    const IconButton = res.props.children.type;
    const originalProps = res.props.children.props;

    const openCustomPage = () => {
      console.log("[BetterInbox] Intercepted YouBar click!");

      // Attempt 1: Discord Native Stack Push (openLazy)
      if (Router?.openLazy) {
        try {
          Router.openLazy(
            async () => () => React.createElement(NotificationCenterUI),
            "BetterInboxPage",
            { title: "Better Inbox" }
          );
          return;
        } catch (err) {
          console.error("[BetterInbox] openLazy failed:", err);
        }
      }

      // Attempt 2: NavigationNative Push
      const rootNav = tabsNavigationRef?.getRootNavigationRef?.();
      if (rootNav?.push) {
        try {
          rootNav.push("CustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(NotificationCenterUI),
          });
          return;
        } catch (err) {
          console.error("[BetterInbox] rootNav.push failed:", err);
        }
      }

      // Attempt 3: Direct NavigationNative navigate
      if (NavigationNative?.navigate) {
        try {
          NavigationNative.navigate("VendettaCustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(NotificationCenterUI),
          });
        } catch (err) {
          console.error("[BetterInbox] NavigationNative.navigate failed:", err);
        }
      }
    };

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
