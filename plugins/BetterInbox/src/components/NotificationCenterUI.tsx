import { findByName, findByProps, findByDisplayName } from "@vendetta/metro";
import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { Forms } from "@vendetta/ui/components";
import {
  NotificationCategory,
  MentionSubCategory,
  NotificationItem,
  LocalStorage,
} from "../types";

const { ScrollView, View, Text, TouchableOpacity, StyleSheet } = ReactNative;
const { useState } = React;

const { FormSection, FormRow, FormText, FormIcon } = Forms;

// Safely resolve Discord's native SegmentedControl
const NativeSegmentedControl =
  findByDisplayName("SegmentedControl") ||
  findByName("SegmentedControl") ||
  findByProps("SegmentedControl")?.SegmentedControl;

const Navigation = findByProps("push", "pop");
const Router = findByProps("transitionToGuild", "transitionTo");

export default function NotificationCenterUI(): JSX.Element {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [subFilterIndex, setSubFilterIndex] = useState(0);

  const tabs: NotificationCategory[] = ["mentions", "replies", "reactions", "other"];
  const subFilters: Array<"all" | MentionSubCategory> = ["all", "people", "role", "bot"];

  const activeTab = tabs[activeTabIndex];
  const mentionFilter = subFilters[subFilterIndex];

  const pluginStorage = (storage as LocalStorage) || { notifications: [] };
  const notifications: NotificationItem[] = pluginStorage.notifications || [];

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

    try {
      if (Navigation?.pop) Navigation.pop();

      if (Router?.transitionToGuild) {
        Router.transitionToGuild(guildId || "@me", channelId, messageId);
      } else if (NavigationNative?.navigate) {
        NavigationNative.navigate("Channel", { guildId, channelId, messageId });
      }
    } catch (err) {
      console.error("[BetterInbox] Navigation error:", err);
    }
  };

  // Helper to render SegmentedControl safely or fall back to native-feeling chips
  const renderPicker = (
    values: string[],
    selectedIndex: number,
    onChange: (index: number) => void
  ) => {
    if (NativeSegmentedControl) {
      return (
        <NativeSegmentedControl
          values={values}
          selectedIndex={selectedIndex}
          onChange={(e: any) => {
            const idx = typeof e === "number" ? e : e?.nativeEvent?.selectedSegmentIndex;
            if (typeof idx === "number") onChange(idx);
          }}
        />
      );
    }

    // Zero-overhead fallback using simple native views if SegmentedControl isn't found
    return (
      <View style={styles.chipRow}>
        {values.map((val, idx) => (
          <TouchableOpacity
            key={val}
            style={[styles.chip, selectedIndex === idx && styles.chipActive]}
            onPress={() => onChange(idx)}
          >
            <Text style={[styles.chipText, selectedIndex === idx && styles.chipTextActive]}>
              {val}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Category Selection */}
      <View style={styles.pickerContainer}>
        {renderPicker(
          tabs.map((t) => t.charAt(0).toUpperCase() + t.slice(1)),
          activeTabIndex,
          setActiveTabIndex
        )}
      </View>

      {/* Mentions Sub-Filter */}
      {activeTab === "mentions" && (
        <View style={styles.pickerContainer}>
          {renderPicker(
            subFilters.map((s) => s.toUpperCase()),
            subFilterIndex,
            setSubFilterIndex
          )}
        </View>
      )}

      {/* Native Form Section Feed */}
      <FormSection title={`NOTIFICATIONS (${filteredNotifications.length})`}>
        {filteredNotifications.length === 0 ? (
          <FormRow
            label="No notifications"
            subLabel="Nothing found in this category."
            disabled
          />
        ) : (
          filteredNotifications.map((item) => (
            <FormRow
              key={item.id}
              label={item.title}
              subLabel={`${item.guildName} — ${item.channelName}\n${item.content}`}
              leading={
                <FormIcon
                  style={styles.avatar}
                  source={{
                    uri: item.author?.avatar
                      ? `https://cdn.discordapp.com/avatars/${item.author.id}/${item.author.avatar}.png`
                      : "https://cdn.discordapp.com/embed/avatars/0.png",
                  }}
                />
              }
              trailing={<FormText style={styles.timestamp}>{item.timestamp}</FormText>}
              onPress={() => jumpToMessage(item.guildId, item.channelId, item.messageId)}
            />
          ))
        )}
      </FormSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  timestamp: {
    fontSize: 12,
    color: "#949ba4",
  },
  chipRow: {
    flexDirection: "row",
    backgroundColor: "#2b2d31",
    borderRadius: 8,
    padding: 3,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  chipActive: {
    backgroundColor: "#1e1f22",
  },
  chipText: {
    color: "#949ba4",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
});
