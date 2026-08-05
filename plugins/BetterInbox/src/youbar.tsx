import { findByProps, findByTypeName } from "@vendetta/metro";
import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { instead } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import NotificationCenterUI from "./components/NotificationCenterUI";

const { View, Text, TouchableOpacity, SafeAreaView, StyleSheet } = ReactNative;
const tabsNavigationRef = findByProps("getRootNavigationRef");

// Custom Container that injects the Header + Close Button and Safe Area
function PageWrapper() {
  const handleClose = () => {
    try {
      const rootNav = tabsNavigationRef?.getRootNavigationRef?.();
      if (rootNav?.goBack) {
        rootNav.goBack();
      } else if (NavigationNative?.goBack) {
        NavigationNative.goBack();
      }
    } catch (err) {
      console.error("[BetterInbox] Failed to navigate back:", err);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper}>
      {/* Page Header Bar with X Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Better Inbox</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main Inbox View */}
      <NotificationCenterUI />
    </SafeAreaView>
  );
}

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

    const openPage = () => {
      console.log("[BetterInbox] Opening Inbox Page...");

      const navigation = tabsNavigationRef?.getRootNavigationRef?.();

      if (navigation?.navigate) {
        try {
          navigation.navigate("VendettaCustomPage", {
            title: "Better Inbox",
            render: () => React.createElement(PageWrapper),
          });
          return;
        } catch (err) {
          console.error("[BetterInbox] Navigation error:", err);
        }
      }
    };

    return (
      <IconButton
        variant={originalProps?.variant || "tertiary"}
        size={originalProps?.size || "sm"}
        icon={BellIcon || originalProps?.icon}
        onPress={openPage}
      />
    );
  });
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#1e1f22",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1e1f22",
    borderBottomWidth: 1,
    borderBottomColor: "#2b2d31",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2b2d31",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#dbdee1",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: -2,
  },
});
