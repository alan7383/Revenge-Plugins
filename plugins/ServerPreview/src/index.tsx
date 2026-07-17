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
      console.error("[Lurker] InviteDetails target binding not found.");
      return;
    }

    // Intercept the default instantiation factory wrapper execution map
    unpatchInviteDetails = patcher.after("default", InviteDetailsModule, (args, res) => {
      const inviteData = args[0]?.invite;
      if (!inviteData || !inviteData.guild) return res;

      const targetGuildId = inviteData.guild.id;

      // Deep search helper to find the ButtonGroup child array inside the bytecode structure
      function findAndPatchButtons(node: any): boolean {
        if (!node || typeof node !== "object") return false;

        // Check if this node has props and children
        if (node.props && node.props.children) {
          const children = node.props.children;

          if (Array.isArray(children)) {
            // Identify if this specific array contains the action buttons by checking properties
            const hasActionButtons = children.some(
              (child: any) => child?.props && ('onPress' in child.props || 'text' in child.props)
            );

            if (hasActionButtons) {
              // Check if our button is already added to prevent duplicates
              const alreadyHasLurk = children.some(
                (child: any) => child?.props?.accessibilityLabel === "Lurk Preview Button"
              );

              if (!alreadyHasLurk) {
                // Safely grab the original button component class/function type to maintain native styling
                const OriginalButtonComponent = children[0]?.type;

                if (OriginalButtonComponent) {
                  const customLurkButton = React.createElement(OriginalButtonComponent, {
                    variant: "secondary", 
                    size: "lg",
                    text: "Lurk Preview",
                    accessibilityLabel: "Lurk Preview Button",
                    style: { marginTop: 8 },
                    onPress: () => lurk(targetGuildId),
                  });

                  // Add our button right into the action group layout array
                  children.push(customLurkButton);
                  return true;
                }
              }
            }

            // If it's a normal array but not the button container, keep digging down each branch
            for (const child of children) {
              if (findAndPatchButtons(child)) return true;
            }
          } else if (typeof children === "object") {
            // Dig deeper into single child objects
            return findAndPatchButtons(children);
          }
        }

        // Handle situations where the layout nodes are nested arrays directly
        if (Array.isArray(node)) {
          for (const item of node) {
            if (findAndPatchButtons(item)) return true;
          }
        }

        return false;
      }

      // Start the recursive traversal through the compiled layout object tree
      findAndPatchButtons(res);

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
