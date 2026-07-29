import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { React, clipboard, toast } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

// Using IdIcon as requested (with fallbacks just in case)
const IdIcon =
    getAssetIDByName("ic_id") ??
    getAssetIDByName("IdIcon") ??
    getAssetIDByName("id");

let unpatchOpenLazy: (() => void) | null = null;

export default {
    onLoad() {
        unpatchOpenLazy = before(
            "openLazy",
            ActionSheet,
            ([comp, args, msg]) => {
                // Ensure we only touch the message long-press menu
                if (
                    args !== "MessageLongPressActionSheet" ||
                    !msg?.message
                ) {
                    return;
                }

                const message = msg.message;
                const authorId = message.author?.id;

                if (!authorId) return;

                comp.then((instance: any) => {
                    const unpatch = after(
                        "default",
                        instance,
                        (_args: any, component: any) => {
                            React.useEffect(() => () => unpatch(), []);

                            const groups: any[] = findInReactTree(
                                component,
                                (c: any) =>
                                    Array.isArray(c) &&
                                    c[0]?.type?.name === "ActionSheetRowGroup"
                            );

                            if (!groups?.length) return;

                            // Define our "Copy User ID" button
                            const copyIdButton = React.createElement(
                                ActionSheetRow,
                                {
                                    label: "Copy User ID",
                                    icon: React.createElement(
                                        ActionSheetRow.Icon,
                                        {
                                            source: IdIcon
                                        }
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

                            // Inject the button into the first ActionSheetRowGroup
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
                });
            }
        );
    },

    onUnload() {
        unpatchOpenLazy?.();
        unpatchOpenLazy = null;
    }
};
