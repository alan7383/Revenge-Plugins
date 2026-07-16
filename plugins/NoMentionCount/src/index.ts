import { findByProps, findByStoreName } from "@Vendetta/metro";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

const { getMentionCount } = findByProps("getMentionCount");
const ChannelStore = findByStoreName("ChannelStore");

// Initialize storage
storage.hiddenChannels ??= [];
storage.hiddenGuilds ??= [];

let mentionPatches: (() => void)[] = [];

function patchGetMentionCount() {
    const orig = getMentionCount;
    
    getMentionCount = function(channelId: string) {
        const result = orig(channelId);
        if (result === 0) return 0;
        
        const channel = ChannelStore?.getChannel(channelId);
        if (!channel) return result;
        
        // Check if this channel's guild is in the hidden list
        if (storage.hiddenGuilds?.includes(channel.guild_id)) {
            return 0;
        }
        
        // Check if this specific channel is in the hidden list
        if (storage.hiddenChannels?.includes(channelId)) {
            return 0;
        }
        
        return result;
    };
    
    return () => {
        getMentionCount = orig;
    };
}

export default {
    onLoad() {
        mentionPatches.push(patchGetMentionCount());
    },
    
    onUnload() {
        for (const unpatch of mentionPatches) unpatch();
        mentionPatches = [];
    },
    
    settings: Settings,
};
