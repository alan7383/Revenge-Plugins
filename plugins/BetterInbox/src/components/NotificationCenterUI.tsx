import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { Forms, SegmentedControl } from "@vendetta/ui/components";
import {
  NotificationCategory,
  MentionSubCategory,
  NotificationItem,
  LocalStorage,
} from "../types";

const { ScrollView, View, StyleSheet } = ReactNative;
const { useState } = React;

const { FormSection, FormRow, FormText, FormIcon } = Forms;
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

  return (
    <ScrollView style={styles.container}>
      {/* Native Discord Segmented Control for Main Categories */}
      <View style={styles.pickerContainer}>
        <SegmentedControl
          values={tabs.map((t) => t.charAt(0).toUpperCase() + t.slice(1))}
          selectedIndex={activeTabIndex}
          onChange={(idx: number) => setActiveTabIndex(idx)}
        />
      </View>

      {/* Native Mentions Sub-Filter */}
      {activeTab === "mentions" && (
        <View style={styles.pickerContainer}>
          <SegmentedControl
            values={subFilters.map((s) => s.toUpperCase())}
            selectedIndex={subFilterIndex}
            onChange={(idx: number) => setSubFilterIndex(idx)}
          />
        </View>
      )}

      {/* Native Form Section & Rows for Zero-Lag Feed */}
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
});
