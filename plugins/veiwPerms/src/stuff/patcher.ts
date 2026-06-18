import { patcher } from "@vendetta";
import { findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import PermissionViewer from "./components/PermissionViewer";

let unpatches: (() => void)[] = [];

export function startPatches() {
    const UserProfileAboutMeCard = findByName("UserProfileAboutMeCard", false);
    if (!UserProfileAboutMeCard) return;

    const patch = patcher.after("default", UserProfileAboutMeCard, ([props], res) => {
        if (!props?.user || !props?.guildId) return res;

        // Cleanly inject our standalone React element directly into the component tree
        res.props.children = [
            res.props.children,
            React.createElement(PermissionViewer, {
                userId: props.user.id,
                guildId: props.guildId
            })
        ];

        return res;
    });

    if (patch) unpatches.push(patch);
}

export function stopPatches() {
    for (const unpatch of unpatches) {
        if (typeof unpatch === "function") unpatch();
    }
    unpatches = [];
}
