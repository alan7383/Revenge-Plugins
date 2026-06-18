import patcher from "./stuff/patcher";

let unpatchExecutionLoop: (() => void) | null = null;

export function onLoad() {
    unpatchExecutionLoop = patcher();
}

export function onUnload() {
    if (unpatchExecutionLoop) {
        unpatchExecutionLoop();
        unpatchExecutionLoop = null;
    }
}
