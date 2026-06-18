import { patcher } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { getUserPermissions } from "./stuff/permissions";

// Hold our patch cancellation functions so we can clean up onUnload
let patches: (() => void)[] = [];

export const onLoad = () => {
    try {
        // Find the user profile components normally using findByName
        const UserProfileAboutMeCard = findByName("UserProfileAboutMeCard", false);

        if (UserProfileAboutMeCard) {
            patches.push(
                patcher.after("default", UserProfileAboutMeCard, ([props], res) => {
                    // Safety check to ensure we have a valid user object
                    if (!props?.user) return res;

                    // Fetch the calculated permissions array for this user
                    const permissions = getUserPermissions(props.guildId, props.user.id);

                    // If they don't have special permissions or we aren't in a guild, change nothing
                    if (permissions.length === 0) return res;

                    // Inject our custom layout into the React tree safely
                    try {
                        const originalChildren = res?.props?.children;
                        
                        // Append our permissions list under the original components
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
                    } catch (err) {
                        console.error("[PermViewer] Failed to inject React elements:", err);
                    }

                    return res;
                })
            );
        }
    } catch (e) {
        console.error("[PermViewer] Plugin initialization failed:", e);
    }
};

export const onUnload = () => {
    // Unpatch everything cleanly when the plugin is disabled
    for (const unpatch of patches) {
        unpatch();
    }
    patches = [];
};
