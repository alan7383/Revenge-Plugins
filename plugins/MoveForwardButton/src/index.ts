import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");
const ForwardModule = findByProps("openForwardModal");

const ForwardIcon = getAssetIDByName("ArrowAngleRightUpIcon");

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

                comp.then((instance: any) => {
                    instance.__currentActiveMessage = msg.message;

                    if (instance.__patchedForForward) return;
                    instance.__patchedForForward = true;

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

                            // Prevent duplicate injection
                            const alreadyExists = findInReactTree(
                                component,
                                (c: any) =>
                                    c?.props?.label === "Forward Message"
                            );
                            if (alreadyExists) return;

                            // Locate the children array of top group (groups[0])
                            const topGroupChildren: any[] = findInReactTree(
                                groups[0],
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c.some(
                                        (child: any) =>
                                            child?.type?.name ===
                                            "ActionSheetRow"
                                    )
                            );

                            if (!topGroupChildren) return;

                            // Create Forward Message row
                            const forwardButton = React.createElement(
                                ActionSheetRow,
                                {
                                    label: "Forward Message",
                                    icon: React.createElement(
                                        ActionSheetRow.Icon,
                                        { source: ForwardIcon }
                                    ),
                                    onPress: () => {
                                        const currentMsg =
                                            instance.__currentActiveMessage;

                                        ActionSheet.hideActionSheet();

                                        if (!currentMsg) return;

                                        setTimeout(() => {
                                            ForwardModule?.openForwardModal?.({
                                                message: currentMsg,
                                                source: "message_context_menu"
                                            });
                                        }, 100);
                                    }
                                }
                            );

                            // Insert right under Copy User ID (or append to top group)
                            const copyIdIdx = topGroupChildren.findIndex(
                                (c: any) => c?.props?.label === "Copy User ID"
                            );

                            if (copyIdIdx !== -1) {
                                topGroupChildren.splice(
                                    copyIdIdx + 1,
                                    0,
                                    forwardButton
                                );
                            } else {
                                topGroupChildren.push(forwardButton);
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
