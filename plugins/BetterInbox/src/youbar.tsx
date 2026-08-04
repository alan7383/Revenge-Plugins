import { findByName, findByProps, findByTypeName } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import NotificationCenterUI from "./components/NotificationCenterUI";

const { TouchableOpacity } = ReactNative;

// Get Discord's navigation ref and the native BellIcon
const tabsNavigationRef = findByProps("getRootNavigationRef");
const BellIcon = findByName("BellIcon") || findByProps("BellIcon")?.BellIcon;

export function patchYouBar() {
  const YouBarNotificationsButton = findByTypeName("YouBarNotificationsButton");

  if (!YouBarNotificationsButton) {
    console.warn("[BetterInbox] YouBarNotificationsButton component not found");
    return () => {};
  }

  // Replace the native button's render completely with our own custom component
  return instead("type", YouBarNotificationsButton, (args, OriginalRender) => {
    // We grab the native props so we keep standard tab bar sizing/styles if needed
    const props = args[0] || {};

    const openCustomNotificationPage = () => {
      console.log("[BetterInbox] Opening custom notification page via VendettaCustomPage");

      const navigation = tabsNavigationRef?.getRootNavigationRef?.();
      if (navigation?.navigate) {
        navigation.navigate("VendettaCustomPage", {
          title: "Inbox",
          render: () => React.createElement(NotificationCenterUI),
        });
      }
    };

    return (
      <TouchableOpacity
        onPress={openCustomNotificationPage}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 5,
        }}
        activeOpacity={0.7}
      >
        {BellIcon ? (
          <BellIcon color="#949ba4" size="24px" />
        ) : (
          // Fallback native render if BellIcon resolution fails
          OriginalRender(...args)
        )}
      </TouchableOpacity>
    );
  });
}
