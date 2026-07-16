import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];

let patches = [];

export default {
  onLoad() {
    // 1. Channel / Direct Mention Store
    const MentionStore = findByProps("getMentionCount");
    
    // 2. Server/Guild Badge Stores (Where Discord aggregates counts for the server list)
    const GuildMentionStore = findByProps("getTotalMentionCount"); 

    // Patch channel mentions
    if (MentionStore) {
      patches.push(
        after("getMentionCount", MentionStore, ([id], returnValue) => {
          if (storage.hiddenChannelIds.includes(id) || storage.hiddenGuildIds.includes(id)) {
            return 0;
          }
          return returnValue;
        })
      );
    }

    // Patch server list badges
    if (GuildMentionStore) {
      // Discord uses getTotalMentionCount(guildId) for the server icon badge
      patches.push(
        after("getTotalMentionCount", GuildMentionStore, ([guildId], returnValue) => {
          if (storage.hiddenGuildIds.includes(guildId)) {
            return 0;
          }
          return returnValue;
        })
      );
    }
  },

  onUnload() {
    for (const unpatch of patches) {
      unpatch();
    }
    patches = [];
  },

  settings: Settings,
};
