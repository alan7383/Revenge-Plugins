import { storage } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import Settings from "./Settings";

const socketModule = findByProps("getSocket", "isConnected");

const SPOOF_PROPERTIES: Record<string, Record<string, string>> = {
    desktop: { browser: "Discord Client" },
    web: { browser: "Chrome" },
    meta: { browser: "Discord VR" },
    console: { browser: "Discord Embedded" },
};

const IDENTIFY = 2;
let unpatchSocket: (() => void) | null = null;

function applySpoof(data: any) {
    const currentPlatform = storage.platform || "off";

    if (
        currentPlatform === "off" ||
        !SPOOF_PROPERTIES[currentPlatform]
    ) {
        return;
    }

    if (data && data.properties) {
        Object.assign(
            data.properties,
            SPOOF_PROPERTIES[currentPlatform]
        );
    }
}

function patchGateway() {
    const socket = socketModule?.getSocket();
    if (!socket) return null;

    const origSend = socket.send;

    socket.send = function (
        op: number,
        data: any,
        flag: any
    ) {
        if (op === IDENTIFY && data) {
            applySpoof(data);
        }

        return origSend.call(
            this,
            op,
            data,
            flag
        );
    };

    const ws = socket.webSocket;
    let origWsSend: any = null;

    if (
        ws &&
        typeof ws.send === "function"
    ) {
        origWsSend = ws.send;

        ws.send = function (data: any) {
            if (typeof data === "string") {
                try {
                    const parsed = JSON.parse(data);

                    if (
                        parsed?.op === IDENTIFY &&
                        parsed.d
                    ) {
                        applySpoof(parsed.d);
                        data = JSON.stringify(parsed);
                    }
                } catch (e) {}
            }

            return origWsSend.call(
                this,
                data
            );
        };
    }

    return () => {
        if (socket) {
            socket.send = origSend;
        }

        if (ws && origWsSend) {
            ws.send = origWsSend;
        }
    };
}

export default {
    onLoad: () => {
        if (!storage.platform) {
            storage.platform = "off";
        }

        setTimeout(() => {
            unpatchSocket = patchGateway();
        }, 500);
    },

    onUnload: () => {
        if (unpatchSocket) {
            unpatchSocket();
            unpatchSocket = null;
        }
    },

    settings: Settings,
};