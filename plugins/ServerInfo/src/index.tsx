import { find, findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import ServerInfoView from "./components/ServerInfoView";

const { openLazy } = findByProps("openLazy") ?? {};

let unpatch: (() => void) | undefined;

function patchGuildMenu(): () => void {
    const mod = find((m: any) => m?.default?.name === "getGuildsBarGuildMenuItems");
    if (!mod?.default || !openLazy) return () => {};

    return after("default", mod, (args: any[], ret: any) => {
        const guildId = args?.[0];
        if (!guildId || !Array.isArray(ret)) return ret;

        const id = String(guildId);

        const serverInfoItem = {
            label: "Server Info",
            action: () => {
                openLazy(
                    Promise.resolve({ default: ServerInfoView }),
                    "server-info-actionsheet-" + id,
                    { guildId: id }
                );
            },
        };

        return [...ret, serverInfoItem];
    });
}

export default {
    onLoad: () => {
        try {
            unpatch = patchGuildMenu();
        } catch (error) {
            console.error("[ServerInfo] Failed to apply guildMenu patch:", error);
        }
    },
    onUnload: () => {
        try {
            unpatch?.();
        } catch {
            /* ignore */
        }
        unpatch = undefined;
    },
};
