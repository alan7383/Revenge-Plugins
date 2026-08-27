import { findByProps } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// 1. Resolve Metro modules dynamically
const MessageActions =
    findByProps("deleteMessage", "dismissAutomodMessage") ??
    findByProps("deleteMessage");

const RowManager = findByProps("getRow", "getRows");
const MessageRow = findByProps("MessageRow") ?? findByProps("handleTap");

let patches: Array<() => void> = [];
const clickTracker = new Map<string, { count: number; timer: NodeJS.Timeout }>();

// Helper to fire message deletion safely
function triggerMessageDelete(channelId: string, messageId: string) {
    if (!MessageActions?.deleteMessage) {
        showToast("Error: deleteMessage API unavailable", undefined);
        return;
    }

    try {
        MessageActions.deleteMessage(channelId, messageId);
        showToast("Message deleted", undefined);
    } catch (err: any) {
        showToast(`Delete failed: ${err?.message || err}`, undefined);
    }
}

// Track taps and fire on 3rd click within 400ms window
function handleMessageTap(channelId: string, messageId: string, originalPress?: Function, args?: any) {
    const current = clickTracker.get(messageId) || {
        count: 0,
        timer: setTimeout(() => {}, 0),
    };

    clearTimeout(current.timer);
    const newCount = current.count + 1;

    if (newCount >= 3) {
        // Triple-tap reached: cancel original action & delete message
        clickTracker.delete(messageId);
        triggerMessageDelete(channelId, messageId);
        return true; // Interrupted
    }

    // Set 400ms tap window
    const timer = setTimeout(() => {
        clickTracker.delete(messageId);
    }, 400);

    clickTracker.set(messageId, { count: newCount, timer });

    // Allow normal press behavior for 1st and 2nd taps
    if (originalPress) {
        return originalPress.apply(this, args);
    }
    return false;
}

export default {
    onLoad: () => {
        if (!MessageActions?.deleteMessage) {
            showToast("Failed to find MessageActions module", undefined);
            return;
        }

        // Patch strategy 1: Direct RowManager press hook (most accurate on mobile RN)
        if (RowManager?.prototype) {
            patches.push(
                instead("generateRows", RowManager.prototype, (args, orig) => {
                    const rows = orig.apply(this, args);
                    if (!Array.isArray(rows)) return rows;

                    return rows.map((row) => {
                        if (row?.type === "MESSAGE" && row?.message) {
                            const origOnPress = row.onPress;
                            row.onPress = (...pressArgs: any[]) => {
                                const interrupted = handleMessageTap(
                                    row.message.channel_id || row.message.channelId,
                                    row.message.id,
                                    origOnPress,
                                    pressArgs
                                );
                                if (!interrupted && typeof origOnPress === "function") {
                                    origOnPress(...pressArgs);
                                }
                            };
                        }
                        return row;
                    });
                })
            );
        }

        // Patch strategy 2: Fallback to MessageRow component props
        if (MessageRow && patches.length === 0) {
            const targetMethod = MessageRow.handleTap ? "handleTap" : "default";
            patches.push(
                instead(targetMethod, MessageRow, (args, orig) => {
                    const [props] = args;
                    const message = props?.message || args[1];
                    const messageId = message?.id;
                    const channelId = message?.channel_id || message?.channelId;

                    if (!messageId || !channelId) {
                        return orig.apply(this, args);
                    }

                    const interrupted = handleMessageTap(channelId, messageId, orig, args);
                    if (!interrupted) {
                        return orig.apply(this, args);
                    }
                })
            );
        }

        if (patches.length === 0) {
            showToast("TripleTapDelete: Failed to hook row press", undefined);
        }
    },

    onUnload: () => {
        patches.forEach((unpatch) => unpatch());
        patches = [];

        clickTracker.forEach((val) => clearTimeout(val.timer));
        clickTracker.clear();
    },
};
