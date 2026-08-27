import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

const MessageActions =
    findByProps("deleteMessage", "dismissAutomodMessage") ??
    findByProps("deleteMessage");

const MessagePressHook = findByProps("useOnPressMessageItem");

let patches: Array<() => void> = [];
const clickTracker = new Map<string, { count: number; timer: NodeJS.Timeout }>();

function triggerDelete(channelId: string, messageId: string) {
    if (!MessageActions?.deleteMessage) return;
    try {
        MessageActions.deleteMessage(channelId, messageId);
        showToast("Message deleted", undefined);
    } catch (err: any) {
        showToast(`Delete failed: ${err?.message || err}`, undefined);
    }
}

function processTap(channelId: string, messageId: string): boolean {
    const current = clickTracker.get(messageId) || {
        count: 0,
        timer: setTimeout(() => {}, 0),
    };

    clearTimeout(current.timer);
    const newCount = current.count + 1;

    if (newCount >= 3) {
        clickTracker.delete(messageId);
        triggerDelete(channelId, messageId);
        return true; // Interrupted 3rd click
    }

    const timer = setTimeout(() => {
        clickTracker.delete(messageId);
    }, 400);

    clickTracker.set(messageId, { count: newCount, timer });
    return false;
}

export default {
    onLoad: () => {
        if (!MessageActions?.deleteMessage) {
            showToast("Failed to find MessageActions API", undefined);
            return;
        }

        if (MessagePressHook?.useOnPressMessageItem) {
            patches.push(
                after("useOnPressMessageItem", MessagePressHook, (args, origPress) => {
                    const [message] = args;
                    const messageId = message?.id;
                    const channelId = message?.channel_id || message?.channelId;

                    if (!messageId || !channelId) return origPress;

                    return (...pressArgs: any[]) => {
                        const interrupted = processTap(channelId, messageId);
                        if (!interrupted && typeof origPress === "function") {
                            origPress(...pressArgs);
                        }
                    };
                })
            );
            showToast("TripleTapDelete: Hooked successfully", undefined);
        } else {
            showToast("TripleTapDelete: Hook missing", undefined);
        }
    },

    onUnload: () => {
        patches.forEach((unpatch) => unpatch());
        patches = [];

        clickTracker.forEach((val) => clearTimeout(val.timer));
        clickTracker.clear();
    },
};
