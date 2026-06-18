import { findByName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import PermissionsCard from "../components/PermissionsCard";

const YouAboutMeCard = findByName("YouAboutMeCard", false);
const SimplifiedUserProfileAboutMeCard = findByName("SimplifiedUserProfileAboutMeCard", false);
const UserProfileBio = findByName("UserProfileBio", false);
const UserProfileAboutMeCard = findByName("UserProfileAboutMeCard", false);

export default function patcher() {
    const patches: any[] = [];

    if (YouAboutMeCard) {
        patches.push(after("default", YouAboutMeCard, ([{ userId }], ret) => 
            React.createElement(React.Fragment, {}, [
                React.createElement(PermissionsCard, { userId, variant: "you" }),
                ret
            ])
        ));
    }

    if (UserProfileAboutMeCard) {
        patches.push(after("default", UserProfileAboutMeCard, ([{ userId, style }], ret) => 
            React.createElement(React.Fragment, {}, [
                React.createElement(PermissionsCard, { userId, variant: "simplified", style }),
                ret
            ])
        ));
    }

    if (SimplifiedUserProfileAboutMeCard) {
        patches.push(after("default", SimplifiedUserProfileAboutMeCard, ([{ userId, style }], ret) => 
            React.createElement(React.Fragment, {}, [
                React.createElement(PermissionsCard, { userId, variant: "simplified", style }),
                ret
            ])
        ));
    }

    if (UserProfileBio) {
        patches.push(after("default", UserProfileBio, ([{ displayProfile }], ret) => 
            displayProfile ? React.createElement(React.Fragment, {}, [
                React.createElement(PermissionsCard, { userId: displayProfile.userId, variant: "classic" }),
                ret
            ]) : ret
        ));
    }

    return () => {
        for (const unpatch of patches) unpatch();
    };
}
