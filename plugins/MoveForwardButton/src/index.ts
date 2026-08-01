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

                            // 1. Remove native forward button to avoid duplicate entries
                            for (const g of groups) {
                                const children: any[] = findInReactTree(
                                    g,
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.type?.name ===
                                                "ActionSheetRow"
                                        )
                                );

                                if (children) {
                                    const nativeIdx = children.findIndex(
                                        (c: any) => {
                                            const label = (
                                                c?.props?.label || ""
                                            ).toLowerCase();
                                            return (
                                                label === "forward" ||
                                                label === "forward message"
                                            );
                                        }
                                    );

                                    if (nativeIdx !== -1) {
                                        children.splice(nativeIdx, 1);
                                        break;
                                    }
                                }
                            }

                            // 2. Prevent duplicate injection of this custom button
                            const alreadyExists = findInReactTree(
                                component,
                                (c: any) =>
                                    c?.props?.label === "Forward Message"
                            );
                            if (alreadyExists) return;

                            // 3. Target the top group's children array
                            let targetGroupChildren: any[] | null = null;

                            for (const g of groups) {
                                const children: any[] = findInReactTree(
                                    g,
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.type?.name ===
                                                "ActionSheetRow"
                                        )
                                );

                                if (children?.length) {
                                    targetGroupChildren = children;
                                    break;
                                }
                            }

                            if (!targetGroupChildren) return;

                            // 4. Create the Forward Message row
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

                            // 5. Check if Copy User ID is at index 0, insert at index 1
                            const copyIdIndex = targetGroupChildren.findIndex(
                                (c: any) => c?.props?.label === "Copy User ID"
                            );

                            const insertIndex = copyIdIndex !== -1 ? copyIdIndex + 1 : 1;
                            targetGroupChildren.splice(insertIndex, 0, forwardButton);
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
