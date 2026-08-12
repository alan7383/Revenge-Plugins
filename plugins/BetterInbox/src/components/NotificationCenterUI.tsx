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
const { useState, useMemo, useCallback } = React;

const Router = findByProps("transitionToGuild", "transitionTo");

// Discord Native Component Lookups
const NativeTabs = findByDisplayName("Tabs");
const nativeTabsModule = findByProps("useTabsState");
const useTabsState = nativeTabsModule?.useTabsState;

const NativeSegmentedControl = findByDisplayName("SegmentedControl");

export default function NotificationCenterUI(): JSX.Element {
  if (typeof useProxy === "function" && storage) {
    try {
      useProxy(storage);
    } catch (e) {
      // Ignored
    }
  }

  // Pure React State for crisp, instant UI updates
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [mentionFilterIdx, setMentionFilterIdx] = useState<number>(0);

  const categories: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
  const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

  const currentCategory = categories[activeTabIdx] ?? "mentions";
  const currentMentionFilter = subFilters[mentionFilterIdx] ?? "all";

  // 1. Native Tabs state hook initialized with explicit state sync
  const tabsState = useTabsState
    ? useTabsState({
        items: categories.map((cat) => ({
          id: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
        })),
        initialIndex: 0,
      })
    : null;

  // Sync Tabs state if used
  const handleTabChange = (index: number) => {
    setActiveTabIdx(index);
  };

  const pluginStorage = (storage as LocalStorage) || { notifications: [] };
  const notifications: NotificationItem[] = pluginStorage.notifications || [];

  // 2. Memoize list filtering to eliminate lag
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (currentCategory === "mentions") {
        if (n.category !== "mentions") return false;
        if (currentMentionFilter === "people") return n.subCategory === "people";
        if (currentMentionFilter === "role") return n.subCategory === "role";
        if (currentMentionFilter === "bot") return n.subCategory === "bot";
        return true;
      }
      return n.category === currentCategory;
    });
  }, [notifications, currentCategory, currentMentionFilter]);

  const jumpToMessage = useCallback((guildId?: string, channelId?: string, messageId?: string): void => {
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
  }, []);

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      {NativeTabs && tabsState ? (
        <NativeTabs
          state={{
            ...tabsState,
            activeIndex: activeTabIdx,
            setActiveIndex: (idx: number) => {
              tabsState.setActiveIndex?.(idx);
              handleTabChange(idx);
            },
          }}
        />
      ) : (
        <View style={styles.tabBar}>
          {categories.map((tab, idx) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTabIdx === idx && styles.activeTabButton]}
              onPress={() => setActiveTabIdx(idx)}
            >
              <Text style={[styles.tabText, activeTabIdx === idx && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Mention Sub-Filter Control */}
      {currentCategory === "mentions" && (
        <View style={styles.subFilterWrapper}>
          {NativeSegmentedControl ? (
            <NativeSegmentedControl
              value={currentMentionFilter}
              options={subFilters.map((sub) => ({
                value: sub,
                label: sub.toUpperCase(),
              }))}
              onChange={(val: string) => {
                const targetIdx = subFilters.indexOf(val as any);
                if (targetIdx !== -1) setMentionFilterIdx(targetIdx);
              }}
              onValueChange={(val: string) => {
                const targetIdx = subFilters.indexOf(val as any);
                if (targetIdx !== -1) setMentionFilterIdx(targetIdx);
              }}
            />
          ) : (
            <View style={styles.subFilterBar}>
              {subFilters.map((sub, idx) => (
                <TouchableOpacity
                  key={sub}
                  style={[
                    styles.subFilterButton,
                    mentionFilterIdx === idx && styles.activeSubFilter,
                  ]}
                  onPress={() => setMentionFilterIdx(idx)}
                >
                  <Text style={styles.subFilterText}>{sub.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Feed List */}
      <ScrollView style={styles.feed} removeClippedSubviews={true}>
        {filteredNotifications.length === 0 ? (
          <Text style={styles.emptyText}>No notifications found for this category.</Text>
        ) : (
          filteredNotifications.map((item) => (
            <TouchableOpacity
              key={item.id || `${item.channelId}-${item.messageId}`}
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
  container: { flex: 1, backgroundColor: "#313338" },
  subFilterWrapper: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#1e1f22" },
  tabBar: { flexDirection: "row", backgroundColor: "#2b2d31", paddingVertical: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: "#5865F2" },
  tabText: { color: "#949ba4", fontWeight: "600", fontSize: 13 },
  activeTabText: { color: "#ffffff" },
  subFilterBar: { flexDirection: "row", justifyContent: "center" },
  subFilterButton: { marginHorizontal: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeSubFilter: { backgroundColor: "#404249" },
  subFilterText: { color: "#dbdee1", fontSize: 11, fontWeight: "bold" },
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
