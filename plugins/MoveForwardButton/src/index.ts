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

                            const alreadyExists = findInReactTree(
                                component,
                                (c: any) => c?.props?.label === "Forward Message"
                            );
                            if (alreadyExists) return;

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

                            // Find group children array in groups[0]
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
                                        child?.props?.label === "Forward Message"
                                );

                                if (!hasBtnInGroup) {
                                    // Insert at index 1 so it sits right under "Copy User ID" (index 0)
                                    groupChildren.splice(1, 0, forwardButton);
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

