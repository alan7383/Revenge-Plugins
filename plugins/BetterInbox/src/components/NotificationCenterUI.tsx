import { React, ReactNative, NavigationNative, useProxy } from "@vendetta/metro/common";
import { findByProps, findByDisplayName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import {
  NotificationCategory,
  MentionSubCategory,
  NotificationItem,
  LocalStorage,
} from "../types";

const { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } = ReactNative;
const { useState } = React;

const Router = findByProps("transitionToGuild", "transitionTo");

// Discord Native Component Lookups with Fallbacks
const NativeTabs = findByDisplayName("Tabs");
const nativeTabsModule = findByProps("useTabsState");
const useTabsState = nativeTabsModule?.useTabsState;

const NativeSegmentedControl = findByDisplayName("SegmentedControl");
const nativeSegmentedModule = findByProps("useSegmentedControlState");
const useSegmentedControlState = nativeSegmentedModule?.useSegmentedControlState;

export default function NotificationCenterUI(): JSX.Element {
  if (typeof useProxy === "function" && storage) {
    try {
      useProxy(storage);
    } catch (e) {
      // Ignored
    }
  }

  // Fallback states if native hooks are unavailable in current client build
  const [activeTab, setActiveTab] = useState<NotificationCategory>("mentions");
  const [mentionFilterIndex, setMentionFilterIndex] = useState<number>(0);

  const categories: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
  const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

  // Initialize Discord Native Tabs State if available
  const tabsState = useTabsState
    ? useTabsState({
        items: categories.map((cat) => ({
          id: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
        })),
        initialIndex: 0,
      })
    : null;

  // Initialize Discord Native SegmentedControl State if available
  const segmentedState = useSegmentedControlState
    ? useSegmentedControlState({
        items: subFilters.map((sub) => ({
          id: sub,
          label: sub.toUpperCase(),
        })),
        initialIndex: 0,
      })
    : null;

  // Sync active categories & filters depending on native hook usage
  const currentCategory: NotificationCategory = tabsState
    ? categories[tabsState.activeIndex] ?? "mentions"
    : activeTab;

  const currentMentionFilter: "all" | MentionSubCategory = segmentedState
    ? subFilters[segmentedState.selectedIndex] ?? "all"
    : subFilters[mentionFilterIndex] ?? "all";

  const pluginStorage = (storage as LocalStorage) || { notifications: [] };
  const notifications: NotificationItem[] = pluginStorage.notifications || [];

  const filteredNotifications = notifications.filter((n) => {
    if (currentCategory === "mentions") {
      if (n.category !== "mentions") return false;
      if (currentMentionFilter === "people") return n.subCategory === "people";
      if (currentMentionFilter === "role") return n.subCategory === "role";
      if (currentMentionFilter === "bot") return n.subCategory === "bot";
      return true;
    }
    return n.category === currentCategory;
  });

  const jumpToMessage = (guildId?: string, channelId?: string, messageId?: string): void => {
    if (!channelId || !messageId) return;

    try {
      if (Router?.transitionToGuild) {
        Router.transitionToGuild(guildId || "@me", channelId, messageId);
      } else if (NavigationNative?.navigate) {
        NavigationNative.navigate("Channel", { guildId, channelId, messageId });
      }
    } catch (err) {
      console.error("[BetterInbox] Navigation error:", err);
    }
  };

  return (
    <View style={styles.container}>
      {/* Category Tabs (Native or Custom Fallback) */}
      {NativeTabs && tabsState ? (
        <NativeTabs state={tabsState} />
      ) : (
        <View style={styles.tabBar}>
          {categories.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, currentCategory === tab && styles.activeTabButton]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, currentCategory === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Mention Sub-Filter (Native SegmentedControl or Custom Fallback) */}
      {currentCategory === "mentions" && (
        <View style={styles.subFilterWrapper}>
          {NativeSegmentedControl && segmentedState ? (
            <NativeSegmentedControl state={segmentedState} />
          ) : (
            <View style={styles.subFilterBar}>
              {subFilters.map((sub, idx) => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subFilterButton,
                    currentMentionFilter === sub && styles.activeSubFilter,
                  ]}
                  onPress={() => setMentionFilterIndex(idx)}
                >
                  <Text style={styles.subFilterText}>{sub.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Feed List */}
      <ScrollView style={styles.feed}>
        {filteredNotifications.length === 0 ? (
          <Text style={styles.emptyText}>No notifications found for this category.</Text>
        ) : (
          filteredNotifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => jumpToMessage(item.guildId, item.channelId, item.messageId)}
            >
              <Image
                source={{
                  uri: item.author?.avatar
                    ? `https://cdn.discordapp.com/avatars/${item.author.id}/${item.author.avatar}.png`
                    : "https://cdn.discordapp.com/embed/avatars/0.png",
                }}
                style={styles.avatar}
              />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.authorTitle}>{item.title}</Text>
                  <Text style={styles.timestamp}>{item.timestamp}</Text>
                </View>

                <Text style={styles.location}>
                  {item.guildName} — {item.channelName}
                </Text>

                <Text style={styles.messageContent} numberOfLines={2}>
                  {item.content}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#313338",
  },
  subFilterWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#1e1f22",
  },
  // Custom Fallback Styles
  tabBar: { flexDirection: "row", backgroundColor: "#2b2d31", paddingVertical: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: "#5865F2" },
  tabText: { color: "#949ba4", fontWeight: "600", fontSize: 13 },
  activeTabText: { color: "#ffffff" },
  subFilterBar: { flexDirection: "row", justifyContent: "center" },
  subFilterButton: { marginHorizontal: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeSubFilter: { backgroundColor: "#404249" },
  subFilterText: { color: "#dbdee1", fontSize: 11, fontWeight: "bold" },
  // Card List Styles
  feed: { flex: 1, padding: 12 },
  emptyText: { color: "#949ba4", textAlign: "center", marginTop: 40, fontSize: 14 },
  card: {
    flexDirection: "row",
    backgroundColor: "#2b2d31",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorTitle: { color: "#f2f3f5", fontWeight: "bold", fontSize: 14 },
  timestamp: { color: "#949ba4", fontSize: 11 },
  location: { color: "#5865F2", fontSize: 12, marginVertical: 2, fontWeight: "500" },
  messageContent: { color: "#dbdee1", fontSize: 13 },
});
