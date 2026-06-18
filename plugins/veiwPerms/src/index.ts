import { startPatches, stopPatches } from "./patcher";

export const onLoad = () => {
    try {
        startPatches();
    } catch (e) {
        console.error("[PermViewer] Failed to initialize plugin patches:", e);
    }
};

export const onUnload = () => {
    try {
        stopPatches();
    } catch (e) {
        console.error("[PermViewer] Failed to cleanly unload plugin patches:", e);
    }
};
