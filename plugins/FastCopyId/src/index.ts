import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React, clipboard, toast } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

const IdIcon =
    getAssetIDByName("ic_id") ??
    getAssetIDByName("IdIcon") ??
    getAssetIDByName("id");

let unpatches: (() => void)[] = [];

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
                    // Avoid double-patching the same instance
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

                            // Prevent adding the button multiple times if re-rendered
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
                                        ActionSheet.hideActionSheet();
                                        clipboard.setString(authorId);
                                        toast.showToast(
                                            "Copied User ID!",
                                            getAssetIDByName("Check")
                                        );
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
