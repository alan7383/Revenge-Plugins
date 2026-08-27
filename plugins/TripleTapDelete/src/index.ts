import { findByProps } from "@vendetta/metro";
import { instead, after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

const MessageActions =
    findByProps("deleteMessage", "dismissAutomodMessage") ??
    findByProps("deleteMessage");

const MessagesHandlersModule = findByProps("MessagesHandlers");
const MessagesHandlers = MessagesHandlersModule?.MessagesHandlers;

let patches: Array<() => void> = [];
let currentTapCount = 0;
let currentMessageID: string | null = null;
let tapTimeout: NodeJS.Timeout | null = null;

function resetTapState() {
    if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
    }
    currentTapCount = 0;
    currentMessageID = null;
}

function triggerDelete(channelId: string, messageId: string) {
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

function patchHandlers(handlers: any) {
    if (!handlers || handlers.__triple_tap_patched) return;
    handlers.__triple_tap_patched = true;

    if (handlers.handleTapMessage) {
        const patch = after("handleTapMessage", handlers, (args) => {
            const nativeEvent = args?.[0]?.nativeEvent;
            if (!nativeEvent) return;

            const channelId = nativeEvent.channelId;
            const messageId = nativeEvent.messageId;
            if (!channelId || !messageId) return;

            // Track tap sequence per message
            if (currentMessageID === messageId) {
                currentTapCount++;
            } else {
                resetTapState();
                currentTapCount = 1;
                currentMessageID = messageId;
            }

            // Set multi-tap timeout window (400ms)
            if (tapTimeout) clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                resetTapState();
            }, 400);

            // Execute on 3rd tap
            if (currentTapCount >= 3) {
                const targetMessageId = currentMessageID;
                resetTapState();
                triggerDelete(channelId, targetMessageId);
            }
        });

        patches.push(patch);
    }
}

export default {
    onLoad() {
        if (!MessageActions?.deleteMessage) {
            showToast("Failed to find MessageActions API", undefined);
            return;
        }

        if (!MessagesHandlers?.prototype) {
            showToast("Failed to find MessagesHandlers prototype", undefined);
            return;
        }

        const origGetParams = Object.getOwnPropertyDescriptor(
            MessagesHandlers.prototype,
            "params"
        )?.get;

        if (origGetParams) {
            Object.defineProperty(MessagesHandlers.prototype, "params", {
                configurable: true,
                get() {
                    patchHandlers(this);
                    return origGetParams.call(this);
                },
            });

            patches.push(() => {
                try {
                    Object.defineProperty(MessagesHandlers.prototype, "params", {
                        configurable: true,
                        get: origGetParams,
                    });
                } catch (e) {}
            });

            showToast("TripleTapDelete loaded successfully", undefined);
        } else {
            showToast("TripleTapDelete: MessagesHandlers params getter missing", undefined);
        }
    },

    onUnload() {
        resetTapState();
        patches.forEach((unpatch) => unpatch());
        patches = [];
    },
};
