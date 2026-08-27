import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

const MessageActions =
    findByProps("deleteMessage", "dismissAutomodMessage") ??
    findByProps("deleteMessage");

const Dispatcher = findByProps("dispatch", "subscribe");

let unlisten: (() => void) | null = null;
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
        return true;
    }

    const timer = setTimeout(() => {
        clickTracker.delete(messageId);
    }, 450);

    clickTracker.set(messageId, { count: newCount, timer });
    return false;
}

export default {
    onLoad: () => {
        if (!MessageActions?.deleteMessage) {
            showToast("Failed to find MessageActions API", undefined);
            return;
        }

        if (!Dispatcher?.subscribe) {
            showToast("Failed to hook Dispatcher", undefined);
            return;
        }

        // Intercept message interaction dispatches across mobile UI
        const handleDispatch = (event: any) => {
            const messageId = event?.messageId || event?.message?.id || event?.id;
            const channelId = event?.channelId || event?.message?.channel_id || event?.channel_id;

            // Target message touch/selection events
            if (
                event?.type === "MESSAGE_SELECT" ||
                event?.type === "MESSAGE_TAP" ||
                event?.type === "MESSAGE_ACTION_SHEET_OPEN"
            ) {
                if (messageId && channelId) {
                    processTap(channelId, messageId);
                }
            }
        };

        Dispatcher.subscribe("MESSAGE_SELECT", handleDispatch);
        Dispatcher.subscribe("MESSAGE_TAP", handleDispatch);
        Dispatcher.subscribe("MESSAGE_ACTION_SHEET_OPEN", handleDispatch);

        unlisten = () => {
            Dispatcher.unsubscribe("MESSAGE_SELECT", handleDispatch);
            Dispatcher.unsubscribe("MESSAGE_TAP", handleDispatch);
            Dispatcher.unsubscribe("MESSAGE_ACTION_SHEET_OPEN", handleDispatch);
        };

        showToast("TripleTapDelete loaded successfully", undefined);
    },

    onUnload: () => {
        if (unlisten) unlisten();
        clickTracker.forEach((val) => clearTimeout(val.timer));
        clickTracker.clear();
    },
};
