import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

// Safely pull native Clipboard & Toast modules
const ClipboardUtils = findByProps("SUPPORTS_COPY", "copy");
const ToastUtils = findByProps("showToast", "createToast");

const IdIcon =
    getAssetIDByName("ic_id") ??
    getAssetIDByName("IdIcon") ??
    getAssetIDByName("id");

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

                const authorId = msg.message.author?.id;
                if (!authorId) return;

                comp.then((instance: any) => {
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

                            const alreadyHasButton = findInReactTree(
                                component,
                                (c: any) => c?.props?.label === "Copy User ID"
                            );
                            if (alreadyHasButton) return;

                            const copyIdButton = React.createElement(
                                ActionSheetRow,
                                {
                                    label: "Copy User ID",
                                    icon: React.createElement(
                                        ActionSheetRow.Icon,
                                        { source: IdIcon }
                                    ),
                                    onPress: () => {
                                        // 1. Hide the sheet first
                                        ActionSheet.hideActionSheet();

                                        // 2. Delay copying & toast slightly to avoid native thread collisions
                                        setTimeout(() => {
                                            safeCopy(authorId);
                                            
                                            if (ToastUtils?.showToast && ToastUtils?.createToast) {
                                                ToastUtils.showToast(
                                                    ToastUtils.createToast("Copied User ID!", 1)
                                                );
                                            }
                                        }, 100);
                                    }
                                }
                            );

                            let inserted = false;
                            for (let gi = 0; gi < groups.length; gi++) {
                                const groupChildren: any[] = findInReactTree(
                                    groups[gi],
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.type?.name ===
                                                "ActionSheetRow"
                                        )
                                );

                                if (!groupChildren) continue;

                                groupChildren.unshift(copyIdButton);
                                inserted = true;
                                break;
                            }

                            if (!inserted) {
                                groups.unshift(
                                    React.createElement(
                                        ActionSheetRow.Group,
                                        null,
                                        copyIdButton
                                    )
                                );
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
    }
};
