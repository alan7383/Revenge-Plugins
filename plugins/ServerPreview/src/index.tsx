import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { patcher } from "@vendetta"; 
import Settings from "./settings";

const GuildActions = findByProps("joinGuild");
const InviteDetailsModule = findByProps("InviteDetails") || findByProps("InviteHeader");

function lurk(id: string) {
  if (!GuildActions?.joinGuild) {
    showToast("Failed: joinGuild module missing", "Small");
    return;
  }
  GuildActions.joinGuild(id, { lurker: true })
    .then(() => {
      showToast(`Lurking in server: ${id}`, "Check");
    })
    .catch(() => {
      showToast(`Failed to lurk in ${id}`, "Small");
    });
}

let unpatchInviteDetails: () => void;

export default {
  onLoad() {
    if (!InviteDetailsModule) {
      console.error("[Lurker] InviteDetails target binding contextual signature not found.");
      return;
    }

    // Intercept the default instantiation factory wrapper execution map
    unpatchInviteDetails = patcher.after("default", InviteDetailsModule, (args, res) => {
      const inviteData = args[0]?.invite;
      if (!inviteData || !inviteData.guild) return res;

      const targetGuildId = inviteData.guild.id;

      // Safe evaluation context boundary for looking up internal layout trees
      if (res && res.props) {
        let childrenContainer = res.props.children;

        // Trace standard nested layout vectors if Discord is wrapping arrays inside Fragments
        if (childrenContainer && childrenContainer.props && Array.isArray(childrenContainer.props.children)) {
          childrenContainer = childrenContainer.props.children;
        }

        if (Array.isArray(childrenContainer)) {
          // Check if a Lurk button already exists in the stack to prevent memory leaks
          const alreadyHasLurk = childrenContainer.some(
            (child: any) => child?.props?.accessibilityLabel === "Lurk Preview Button"
          );

          if (!alreadyHasLurk) {
            // Locate Discord's original action ButtonGroup container module dynamically inside the schema loop
            const buttonGroupIndex = childrenContainer.findIndex(
              (child: any) => child?.props?.children && Array.isArray(child.props.children) && child.props.children.length >= 1
            );

            // Construct replacement component map mirroring native element layouts
            const ButtonModule = childrenContainer[buttonGroupIndex >= 0 ? buttonGroupIndex : childrenContainer.length - 1]?.props?.children?.[0]?.type;
            
            if (ButtonModule) {
              const customLurkButton = React.createElement(ButtonModule, {
                variant: "secondary", 
                size: "lg",
                text: "Lurk Preview",
                accessibilityLabel: "Lurk Preview Button",
                style: { marginTop: 8 },
                onPress: () => lurk(targetGuildId),
              });

              // Safely splice right above/next to the primary interaction blocks depending on tree indices
              if (buttonGroupIndex !== -1 && Array.isArray(childrenContainer[buttonGroupIndex].props.children)) {
                childrenContainer[buttonGroupIndex].props.children.push(customLurkButton);
              } else {
                childrenContainer.push(customLurkButton);
              }
            }
          }
        }
      }
      return res;
    });
  },

  onUnload() {
    if (typeof unpatchInviteDetails === "function") {
      unpatchInviteDetails();
    }
  },

  settings: Settings,
};
