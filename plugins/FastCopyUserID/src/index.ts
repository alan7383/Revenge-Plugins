import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

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

                            // Prevent duplicate insertions across re-renders
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
                                        ActionSheet.hideActionSheet();

                                        setTimeout(() => {
                                            safeCopy(authorId);

                                            if (
                                                ToastUtils?.showToast &&
                                                ToastUtils?.createToast
                                            ) {
                                                ToastUtils.showToast(
                                                    ToastUtils.createToast(
                                                        "Copied User ID!",
                                                        1
                                                    )
                                                );
                                            }
                                        }, 100);
                                    }
                                }
                            );

                            // Target the first group (`groups[0]`) to put it at the very top
                            const groupChildren: any[] = findInReactTree(
                                groups[0],
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c.some(
                                        (child: any) =>
                                            child?.type?.name ===
                                            "ActionSheetRow"
                                    )
                            );

                            if (groupChildren) {
                                const hasBtnInGroup = groupChildren.some(
                                    (child: any) =>
                                        child?.props?.label === "Copy User ID"
                                );

                                if (!hasBtnInGroup) {
                                    groupChildren.unshift(copyIdButton);
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
    }
};
