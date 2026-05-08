import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Menu } from "@webpack/common";
import type { User } from "@vencord/discord-types";

import { checkAndRequestCsp } from "./csp";
import { openDataModal } from "./DataModal";
import { settings } from "./settings";

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user || !settings.store.apiUrl || !settings.store.apiKey) return;

    children.push(
        <Menu.MenuItem
            id="vc-swallow-open"
            label="Open data"
            action={() => openDataModal(user.id, user.username)}
        />
    );
};

export default definePlugin({
    name: "Swallow",
    description: "Browse archived Discord data for any user via the Swallow API",
    authors: [Devs.m1000],
    settings,

    async start() {
        if (settings.store.apiUrl) {
            await checkAndRequestCsp(settings.store.apiUrl);
        }
    },

    contextMenus: {
        "user-context": userContextPatch,
        "user-profile-actions": userContextPatch,
    },
});
