import { findByProps, findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import NotificationCenterUI from "./components/NotificationCenterUI";

// Retrieve Discord's Sheet & Modal modules
const ActionSheet = findByProps("openLazy", "hideActionSheet");
const ModalAction = findByProps("openModal", "openModalLazy");

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

    const openModalSheet = () => {
      console.log("[BetterInbox] Opening Notification Center Action Sheet...");

      // Attempt 1: ActionSheet.openLazy (Standard Mobile Sheet Launcher)
      if (ActionSheet?.openLazy) {
        try {
          ActionSheet.openLazy(
            async () => () => React.createElement(NotificationCenterUI),
            "BetterInboxSheet"
          );
          return;
        } catch (err) {
          console.error("[BetterInbox] ActionSheet.openLazy failed:", err);
        }
      }

      // Attempt 2: ModalAction.openModalLazy (Fallback Fullscreen Sheet Modal)
      if (ModalAction?.openModalLazy) {
        try {
          ModalAction.openModalLazy(async () => () => React.createElement(NotificationCenterUI));
          return;
        } catch (err) {
          console.error("[BetterInbox] ModalAction.openModalLazy failed:", err);
        }
      }

      console.error("[BetterInbox] No modal sheet launchers available");
    };

    return (
      <IconButton
        variant={originalProps?.variant || "tertiary"}
        size={originalProps?.size || "sm"}
        icon={BellIcon || originalProps?.icon}
        onPress={openModalSheet}
      />
    );
  });
}
