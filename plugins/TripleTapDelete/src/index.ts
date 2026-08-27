import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Extract HTTP RestAPI client instead of relying on MessageActions store
const RestAPI = findByProps("get", "post", "del", "patch");

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

async function deleteMessageDirectly(channelId: string, messageId: string) {
    if (!RestAPI?.del) {
        showToast("Error: RestAPI unavailable", undefined);
        return;
    }

    try {
        await RestAPI.del({ url: `/channels/${channelId}/messages/${messageId}` });
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

            // Track sequential taps on the exact same message
            if (currentMessageID === messageId) {
                currentTapCount++;
            } else {
                resetTapState();
                currentTapCount = 1;
                currentMessageID = messageId;
            }

            // Timeout window for multi-tap detection (400ms)
            if (tapTimeout) clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                resetTapState();
            }, 400);

            // Execute on 3rd tap
            if (currentTapCount >= 3) {
                const targetChannelId = channelId;
                const targetMessageId = currentMessageID;
                resetTapState();
                deleteMessageDirectly(targetChannelId, targetMessageId);
            }
        });

        patches.push(patch);
    }
}

export default {
    onLoad() {
        if (!RestAPI?.del) {
            showToast("Failed to find RestAPI client", undefined);
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

            showToast("TripleTapDelete loaded", undefined);
        } else {
            showToast("TripleTapDelete: getter missing", undefined);
        }
    },

    onUnload() {
        resetTapState();
        patches.forEach((unpatch) => unpatch());
        patches = [];
    },
};
