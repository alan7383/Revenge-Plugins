import { React, ReactNative, NavigationNative, useProxy } from "@vendetta/metro/common";
import { findByProps, findByName, findByDisplayName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import {
  NotificationCategory,
  MentionSubCategory,
  NotificationItem,
  LocalStorage,
} from "../types";

const { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } = ReactNative;
const { useState, useMemo, useCallback, memo } = React;

const Router = findByProps("transitionToGuild", "transitionTo");

// Native UI Component Lookups
const NativeTabs = findByDisplayName("Tabs");
const nativeTabsModule = findByProps("useTabsState");
const useTabsState = nativeTabsModule?.useTabsState;

const NativeSegmentedControl = findByDisplayName("SegmentedControl");

// Native Discord TableRow Components
const TableRow = findByName("TableRow") || findByProps("TableRow")?.TableRow;
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup || View;

// Helper to reliably compute Discord avatar URLs
function getAvatarUrl(author: any): string {
  if (!author) return "https://cdn.discordapp.com/embed/avatars/0.png";

  const { id, avatar, discriminator } = author;

  if (avatar) {
    const isAnimated = typeof avatar === "string" && avatar.startsWith("a_");
    const ext = isAnimated ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
  }

  // Handle Default Discord Avatars (legacy vs pomelo usernames)
  try {
    const defaultIndex = discriminator && discriminator !== "0"
      ? parseInt(discriminator, 10) % 5
      : Number((BigInt(id || "0") >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

// 1. MEMOIZED ROW COMPONENT
const NotificationRow = memo(({ item, onPress }: { item: NotificationItem; onPress: () => void }) => {
  const avatarUrl = getAvatarUrl(item.author);
  const subLabelText = `${item.guildName} • ${item.channelName}\n${item.content || ""}`.trim();

  return (
    <TableRow
      label={item.title}
      subLabel={subLabelText}
      trailingText={item.timestamp}
      icon={
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatarImage}
        />
      }
      onPress={onPress}
    />
  );
});

export default function NotificationCenterUI(): JSX.Element {
  if (typeof useProxy === "function" && storage) {
    try {
      useProxy(storage);
    } catch (e) {
      // Ignored
    }
  }

  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [mentionFilterIdx, setMentionFilterIdx] = useState<number>(0);

  const categories: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
  const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

  const currentCategory = categories[activeTabIdx] ?? "mentions";
  const currentMentionFilter = subFilters[mentionFilterIdx] ?? "all";

  const tabsState = useTabsState
    ? useTabsState({
        items: categories.map((cat) => ({
          id: cat,
          label: cat.charAt(0).toUpperCase() + cat.slice(1),
        })),
        initialIndex: 0,
      })
    : null;

  const pluginStorage = (storage as LocalStorage) || { notifications: [] };
  const notifications: NotificationItem[] = pluginStorage.notifications || [];

  const displayedNotifications = useMemo(() => {
    const filtered = notifications.filter((n) => {
      if (currentCategory === "mentions") {
        if (n.category !== "mentions") return false;
        if (currentMentionFilter === "people") return n.subCategory === "people";
        if (currentMentionFilter === "role") return n.subCategory === "role";
        if (currentMentionFilter === "bot") return n.subCategory === "bot";
        return true;
      }
      return n.category === currentCategory;
    });

    return filtered.slice(0, 30);
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
              setActiveTabIdx(idx);
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

      {/* Feed with TableRowGroup */}
      <ScrollView style={styles.feed} removeClippedSubviews={true}>
        {displayedNotifications.length === 0 ? (
          <Text style={styles.emptyText}>No notifications found for this category.</Text>
        ) : (
          <TableRowGroup title={`RECENT ${currentCategory.toUpperCase()}`}>
            {displayedNotifications.map((item) => (
              <NotificationRow
                key={item.id || `${item.channelId}-${item.messageId}`}
                item={item}
                onPress={() => jumpToMessage(item.guildId, item.channelId, item.messageId)}
              />
            ))}
          </TableRowGroup>
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
  feed: { flex: 1, paddingHorizontal: 8, paddingVertical: 12 },
  emptyText: { color: "#949ba4", textAlign: "center", marginTop: 40, fontSize: 14 },
  avatarImage: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#4e5058" },
});
