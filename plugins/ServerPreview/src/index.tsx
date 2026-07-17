import { findByProps, findByName } from "@vendetta/metro";
import { React, ReactNative as RN } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { storage } from "@vendetta/plugin";
import { patcher } from "@vendetta"; // Use the standard patcher proxy for your platform
import Settings from "./settings";

// 1. Resolve your Metro dependencies
const GuildActions = findByProps("joinGuild");
const InviteDetailsComponent = findByName("InviteDetails", false) || findByProps("InviteDetails");

// Re-using your core business logic methods
function lurk(id: string) {
  if (!GuildActions?.joinGuild) {
    showToast("Failed: joinGuild not found", "Small");
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
    if (!InviteDetailsComponent) {
      console.error("[Lurker] Could not find InviteDetails module context.");
      return;
    }

    // 2. Intercept the render output of InviteDetails
    unpatchInviteDetails = patcher.after("default", InviteDetailsComponent, (args, res) => {
      // args[0] typically holds the 'invite' object passed down by AcceptInvite.tsx
      const inviteData = args[0]?.invite;
      if (!inviteData || !inviteData.guild) return res;

      const targetGuildId = inviteData.guild.id;

      // 3. Navigate into the React layout tree to place your button safely
      if (res && res.props) {
        // Safe arrays conversion so we can comfortably use .push() or .splice()
        res.props.children = React.Children.toArray(res.props.children);

        // 4. Build your custom UI Button Element
        const customLurkButton = React.createElement(
          RN.TouchableOpacity,
          {
            style: {
              backgroundColor: "#23a55a", // Discord green styling variant
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 4,
              marginTop: 10,
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            },
            onPress: () => {
              lurk(targetGuildId);
            }
          },
          React.createElement(
            RN.Text,
            { style: { color: "#ffffff", fontWeight: "bold", fontSize: 16 } },
            "Lurk Server Assets"
          )
        );

        // 5. Append or prepend your node layout right next to the current content children tree
        res.props.children.push(customLurkButton);
      }

      return res;
    });
  },

  onUnload() {
    // 6. Housekeeping cleanup call on plug-out states
    if (typeof unpatchInviteDetails === "function") {
      unpatchInviteDetails();
    }
  },

  settings: Settings,
};

