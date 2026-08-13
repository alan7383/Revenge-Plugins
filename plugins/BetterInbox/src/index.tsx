import { storage } from "@vendetta/plugin";
import patchYouBarButtons from "./youbar";
import { setInboxTracking } from "./notifications";
import NotificationCenterUI from "./components/NotificationCenterUI";

let unpatchButtons: (() => void) | null = null;
let retryInterval: any = null;

export default {
  onLoad: () => {
    storage.showDMButton ??= false;
    storage.showSettingsButton ??= true;
    storage.showInboxButton ??= true;
    storage.notifications ??= [];

    setInboxTracking(true);

    const tryPatch = () => {
      try {
        const cleanup = patchYouBarButtons();
        if (cleanup) {
          unpatchButtons = cleanup;
          if (retryInterval) clearInterval(retryInterval);
        }
      } catch (e) {
        console.error("[BetterInbox] Failed to patch YouBar:", e);
      }
    };

    tryPatch();
    let ticks = 0;
    retryInterval = setInterval(() => {
      if (unpatchButtons) {
        clearInterval(retryInterval);
        return;
      }
      tryPatch();
      if (++ticks >= 20) clearInterval(retryInterval);
    }, 500);
  },

  onUnload: () => {
    if (retryInterval) clearInterval(retryInterval);
    if (unpatchButtons) unpatchButtons();
    setInboxTracking(false);
  },

  settings: NotificationCenterUI,
};
