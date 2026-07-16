import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];

let patches: (() => void)[] = [];

export default {
  onLoad() {
    const MentionStore = findByProps("getMentionCount");
    const GuildMentionStore = findByProps("getTotalMentionCount"); 

    // Patch channel sidebar badges
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

    // Patch server list icon badges
    if (GuildMentionStore) {
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
