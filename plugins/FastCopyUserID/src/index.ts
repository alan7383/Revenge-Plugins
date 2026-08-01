import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";

const ActionSheet = findByProps("openLazy", "hideActionSheet");

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
                    if (instance.__patchedForMoveForward) return;
                    instance.__patchedForMoveForward = true;

                    const unpatchDefault = after(
                        "default",
                        instance,
                        (_args: any, component: any) => {
                            // Find all action sheet row groups
                            const groups: any[] = findInReactTree(
                                component,
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c[0]?.type?.name === "ActionSheetRowGroup"
                            );

                            if (!groups?.length) return;

                            let nativeForwardButton: any = null;
                            let nativeGroupChildren: any[] | null = null;
                            let nativeIndex = -1;

                            // 1. Locate Discord's native Forward button across all groups
                            for (const g of groups) {
                                const children: any[] = findInReactTree(
                                    g,
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.type?.name === "ActionSheetRow"
                                        )
                                );

                                if (children) {
                                    const idx = children.findIndex(
                                        (child: any) =>
                                            child?.props?.label === "Forward" ||
                                            child?.props?.label === "Forward Message"
                                    );

                                    if (idx !== -1) {
                                        nativeForwardButton = children[idx];
                                        nativeGroupChildren = children;
                                        nativeIndex = idx;
                                        break;
                                    }
                                }
                            }

                            if (!nativeForwardButton || !nativeGroupChildren) return;

                            // 2. Locate the group containing "Copy User ID"
                            let copyIdGroupChildren: any[] | null = null;

                            for (const g of groups) {
                                const children: any[] = findInReactTree(
                                    g,
                                    (c: any) =>
                                        Array.isArray(c) &&
                                        c.some(
                                            (child: any) =>
                                                child?.props?.label === "Copy User ID"
                                        )
                                );

                                if (children) {
                                    copyIdGroupChildren = children;
                                    break;
                                }
                            }

                            // Fallback to top group if Copy User ID group isn't found
                            const targetGroupChildren = copyIdGroupChildren ?? findInReactTree(
                                groups[0],
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c.some(
                                        (child: any) =>
                                            child?.type?.name === "ActionSheetRow"
                                    )
                            );

                            if (!targetGroupChildren) return;

                            // Find position of Copy User ID button within that group
                            const copyIdIdx = targetGroupChildren.findIndex(
                                (child: any) => child?.props?.label === "Copy User ID"
                            );

                            const targetIndex = copyIdIdx !== -1 ? copyIdIdx + 1 : 0;

                            // Avoid duplicate moves if it's already in the correct slot
                            if (targetGroupChildren[targetIndex] === nativeForwardButton) return;

                            // 3. Remove native Forward from its original position
                            nativeGroupChildren.splice(nativeIndex, 1);

                            // 4. Place native Forward directly under Copy User ID
                            targetGroupChildren.splice(targetIndex, 0, nativeForwardButton);
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
