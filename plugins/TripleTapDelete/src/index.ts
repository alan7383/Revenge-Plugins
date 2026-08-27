import { findByProps } from "@vendetta/metro";
import { instead } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Metro modules for message actions and UI components
const MessageActions = findByProps("deleteMessage", "dismissAutomodMessage");
const RowManager = findByProps("getRow", "getRows");

let patches: Array<() => void> = [];
const clickTracker = new Map<string, { count: number; timer: NodeJS.Timeout }>();

export default {
    onLoad: () => {
        if (!MessageActions?.deleteMessage) {
            showToast("Failed to find MessageActions module", undefined);
            return;
        }

        // Patch the row press handler (or double tap handler depending on build)
        // Adjust the component patch target if your client uses a custom render row
        const MessageItem = findByProps("Message", "default") || findByProps("MessageRow");
        
        if (!MessageItem) {
            showToast("Failed to find Message UI components", undefined);
            return;
        }

        // Alternative safe target: patch native touch handler on row items
        const TouchHandler = findByProps("handleTap", "handlePress") || MessageItem;

        patches.push(
            instead("handleTap", TouchHandler, (args, orig) => {
                const [event, message] = args;
                const messageId = message?.id;

                if (!messageId || !message?.channel_id) {
                    return orig.apply(this, args);
                }

                const current = clickTracker.get(messageId) || {
                    count: 0,
                    timer: setTimeout(() => {}, 0),
                };

                clearTimeout(current.timer);
                const newCount = current.count + 1;

                if (newCount >= 3) {
                    // Trigger delete on 3rd tap
                    clickTracker.delete(messageId);
                    
                    try {
                        MessageActions.deleteMessage(message.channel_id, messageId);
                        showToast("Deleting message...", undefined);
                    } catch (err: any) {
                        showToast(`Delete failed: ${err?.message || err}`, undefined);
                    }
                    return;
                }

                // Reset click counter after 400ms delay between taps
                const timer = setTimeout(() => {
                    clickTracker.delete(messageId);
                }, 400);

                clickTracker.set(messageId, { count: newCount, timer });
                return orig.apply(this, args);
            })
        );
    },

    onUnload: () => {
        // Clear all patches and active click timers
        patches.forEach((unpatch) => unpatch());
        patches = [];

        clickTracker.forEach((val) => clearTimeout(val.timer));
        clickTracker.clear();
    },
};
