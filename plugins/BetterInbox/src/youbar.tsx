import { React, ReactNative, NavigationNative, useProxy } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import {
  NotificationCategory,
  MentionSubCategory,
  NotificationItem,
  LocalStorage,
} from "../types";

const { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, SafeAreaView } = ReactNative;
const { useState } = React;

const Router = findByProps("transitionToGuild", "transitionTo");
const ActionSheet = findByProps("hideActionSheet");
const ModalAction = findByProps("closeModal", "popWithKey");

export default function NotificationCenterUI(): JSX.Element {
  if (typeof useProxy === "function" && storage) {
    try {
      useProxy(storage);
    } catch (e) {
      // Ignored
    }
  }

  const [activeTab, setActiveTab] = useState<NotificationCategory>("mentions");
  const [mentionFilter, setMentionFilter] = useState<"all" | MentionSubCategory>("all");

  const pluginStorage = (storage as LocalStorage) || { notifications: [] };
  const notifications: NotificationItem[] = pluginStorage.notifications || [];

  // Dedicated dismissal for Action Sheets
  const handleClose = () => {
    try {
      if (ActionSheet?.hideActionSheet) {
        ActionSheet.hideActionSheet("BetterInboxSheet");
      }
      if (ModalAction?.closeModal) {
        ModalAction.closeModal();
      }
    } catch (err) {
      console.error("[BetterInbox] Failed to hide action sheet:", err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "mentions") {
      if (n.category !== "mentions") return false;
      if (mentionFilter === "people") return n.subCategory === "people";
      if (mentionFilter === "role") return n.subCategory === "role";
      if (mentionFilter === "bot") return n.subCategory === "bot";
      return true;
    }
    return n.category === activeTab;
  });

  const jumpToMessage = (guildId?: string, channelId?: string, messageId?: string): void => {
    if (!channelId || !messageId) return;

    handleClose(); // Close the modal sheet before jumping

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

  const tabs: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
  const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

  return (
    <SafeAreaView style={styles.sheetContainer}>
      {/* Action Sheet Drag Indicator / Top Padding space */}
      <View style={styles.dragHandleSpacer}>
        <View style={styles.dragIndicator} />
      </View>

      {/* Action Sheet Header with Close Button */}
      <View style={styles.sheetHeader}>
        <Text style={styles.headerTitle}>Inbox</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Primary Category Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Mentions Sub-Filter */}
      {activeTab === "mentions" && (
        <View style={styles.subFilterBar}>
          {subFilters.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={[styles.subFilterButton, mentionFilter === sub && styles.activeSubFilter]}
              onPress={() => setMentionFilter(sub)}
            >
              <Text style={styles.subFilterText}>{sub.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Notifications List */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    backgroundColor: "#1e1f22", // Matches native Discord bottom sheet background
  },
  dragHandleSpacer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4e5058",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#1e1f22",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "#2b2d31",
    width: 30,
    height: 30,
    alignItems: "center",
    justify.content: "center",
  },
  closeButtonText: {
    color: "#dbdee1",
    fontSize: 14,
    fontWeight: "bold",
    marginTop: -2,
  },
  tabBar: { flexDirection: "row", backgroundColor: "#2b2d31", paddingVertical: 4 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center" },
  activeTabButton: { borderBottomWidth: 2, borderBottomColor: "#5865F2" },
  tabText: { color: "#949ba4", fontWeight: "600", fontSize: 13 },
  activeTabText: { color: "#ffffff" },
  subFilterBar: { flexDirection: "row", backgroundColor: "#1e1f22", padding: 6, justifyContent: "center" },
  subFilterButton: { marginHorizontal: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeSubFilter: { backgroundColor: "#404249" },
  subFilterText: { color: "#dbdee1", fontSize: 11, fontWeight: "bold" },
  feed: { flex: 1, padding: 12, backgroundColor: "#313338" },
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
