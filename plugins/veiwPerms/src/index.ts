import { patcher } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { getUserPermissions } from "./stuff/permissions";

let patches: (() => void)[] = [];

export const onLoad = () => {
    // Wrap the ENTIRE setup in a try/catch. 
    // If anything fails, it catches cleanly instead of crashing the plugin loader loop.
    try {
        const UserProfileAboutMeCard = findByName("UserProfileAboutMeCard", false);

        if (!UserProfileAboutMeCard) {
            console.warn("[PermViewer] Target component not found yet, skipping patch.");
            return;
        }

        const unpatch = patcher.after("default", UserProfileAboutMeCard, ([props], res) => {
            if (!props?.user || !props?.guildId) return res;

            try {
                const permissions = getUserPermissions(props.guildId, props.user.id);
                if (permissions.length === 0) return res;

                const originalChildren = res?.props?.children;

                res.props.children = [
                    originalChildren,
                    React.createElement(
                        "div",
                        {
                            style: {
                                marginTop: 8,
                                padding: 8,
                                backgroundColor: "rgba(0, 0, 0, 0.1)",
                                borderRadius: 4
                            }
                        },
                        React.createElement("strong", null, "Permissions: "),
                        permissions.join(", ")
                    )
                ];
            } catch (patchError) {
                console.error("[PermViewer] Error inside component render patch:", patchError);
            }

            return res;
        });

        if (unpatch) patches.push(unpatch);

    } catch (loopError) {
        // This stops the execution chain from breaking completely
        console.error("[PermViewer] Fatal crash intercepted during onLoad loop:", loopError);
    }
};

export const onUnload = () => {
    for (const unpatch of patches) {
        if (typeof unpatch === "function") unpatch();
    }
    patches = [];
};
