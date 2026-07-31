import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { storage } from "@vendetta/plugin";
import Settings from "./settings";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

const ClipboardUtils = findByProps("SUPPORTS_COPY", "copy");
const ToastPresets = findByProps("presentCopiedToClipboard");

const IdIcon =
    getAssetIDByName("ic_id") ??
    getAssetIDByName("IdIcon") ??
    getAssetIDByName("id");

// Default settings
storage.rowPosition ??= 0;
storage.alwaysTop ??= false;

let unpatches: (() => void)[] = [];

function safeCopy(text: string) {
    try {
        if (ClipboardUtils?.copy) {
            ClipboardUtils.copy(text);
        } else if (ClipboardUtils?.copyToClipboard) {
            ClipboardUtils.copyToClipboard(text);
        }
    } catch (e) {
        console.error("[CopyUserID] Copy failed:", e);
    }
}

export default {
    onLoad() {
        const unpatchOpenLazy = before(
            "openLazy",
            ActionSheet,
            ([comp, args, msg]) => {
                if (
                    args !== "MessageLongPressActionSheet" ||
                    !msg?.message
                ) {
                    return;
                }

                // Store current active message on the lazy instance so onPress always sees the latest target
                comp.then((instance: any) => {
                    instance.__currentActiveMessage = msg.message;

                    if (instance.__patchedForCopyId) return;
                    instance.__patchedForCopyId = true;

                    const unpatchDefault = after(
                        "default",
                        instance,
                        (_args: any, component: any) => {
                            const groups: any[] = findInReactTree(
                                component,
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c[0]?.type?.name === "ActionSheetRowGroup"
                            );

                            if (!groups?.length) return;

                            const alreadyExists = findInReactTree(
                                component,
                                (c: any) => c?.props?.label === "Copy User ID"
                            );
                            if (alreadyExists) return;

                            const copyIdButton = React.createElement(
                                ActionSheetRow,
                                {
                                    label: "Copy User ID",
                                    icon: React.createElement(
                                        ActionSheetRow.Icon,
                                        { source: IdIcon }
                                    ),
                                    onPress: () => {
                                        // Read dynamically from the active message instance
                                        const currentAuthorId =
                                            instance.__currentActiveMessage?.author?.id;

                                        ActionSheet.hideActionSheet();

                                        if (!currentAuthorId) return;

                                        setTimeout(() => {
                                            safeCopy(currentAuthorId);
                                            ToastPresets?.presentCopiedToClipboard?.();
                                        }, 100);
                                    }
                                }
                            );

                            // Handle button positioning
                            if (storage.alwaysTop) {
                                // Always put at very top
                                groups.unshift(
                                    React.createElement(ActionSheetRow.Group, null, copyIdButton)
                                );
                            } else {
                                // Find the target group based on position setting
                                const position = storage.rowPosition ?? 0;
                                let targetGroup = groups[position] || groups[groups.length - 1];
                                
                                // Try to find the group at specified position
                                let groupChildren: any[] = findInReactTree(
                                    targetGroup,
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.type?.name === "ActionSheetRow"
                                        )
                                );

                                // If no children found at that position, find the first valid group
                                if (!groupChildren) {
                                    for (const group of groups) {
                                        const children = findInReactTree(
                                            group,
                                            (c: any) =>
                                                Array.isArray(c) &&
                                                c.some(
                                                    (child: any) =>
                                                        child?.type?.name === "ActionSheetRow"
                                                )
                                        );
                                        if (children) {
                                            groupChildren = children;
                                            break;
                                        }
                                    }
                                }

                                if (groupChildren) {
                                    const hasBtnInGroup = groupChildren.some(
                                        (child: any) =>
                                            child?.props?.label === "Copy User ID"
                                    );

                                    if (!hasBtnInGroup) {
                                        // Insert at top of the target group
                                        groupChildren.unshift(copyIdButton);
                                    }
                                } else {
                                    // Fallback: create new group at top
                                    groups.unshift(
                                        React.createElement(ActionSheetRow.Group, null, copyIdButton)
                                    );
                                }
                            }
                        }
                    );

                    unpatches.push(unpatchDefault);
                });
            }
        );

        unpatches.push(unpatchOpenLazy);
    },

    onUnload() {
        for (const unpatch of unpatches) {
            unpatch?.();
        }
        unpatches = [];
    },

    settings: Settings,
};