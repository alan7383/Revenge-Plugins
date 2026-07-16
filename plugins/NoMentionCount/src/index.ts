import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

// Safely initialize arrays in storage if they don't exist
if (!storage.hiddenChannelIds) storage.hiddenChannelIds = [];
if (!storage.hiddenGuildIds) storage.hiddenGuildIds = [];

let patches = [];

export default {
  onLoad() {
    // Locate the module containing getMentionCount
    const MentionStore = findByProps("getMentionCount");

    if (MentionStore) {
      // Patch 'getMentionCount'
      patches.push(
        after("getMentionCount", MentionStore, ([id], returnValue) => {
          // If the ID matches a hidden channel or guild ID, override return value to 0
          if (
            storage.hiddenChannelIds.includes(id) || 
            storage.hiddenGuildIds.includes(id)
          ) {
            return 0;
          }
          return returnValue;
        })
      );
    }
  },

  onUnload() {
    // Clean up patches when unloading the plugin
    for (const unpatch of patches) {
      unpatch();
    }
  },

  settings: Settings,
};
