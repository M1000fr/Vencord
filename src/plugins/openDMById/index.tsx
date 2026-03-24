/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { PlusIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { createRoot, React, Tooltip } from "@webpack/common";

import { openDMByIdModal } from "./OpenDMModal";

let headerRoot: ReturnType<typeof createRoot> | null = null;
let headerContainer: HTMLElement | null = null;

function OpenDMButton() {
    return (
        <Tooltip text="Ouvrir un DM par ID">
            {(tooltipProps: React.HTMLAttributes<HTMLElement>) => (
                <button
                    {...tooltipProps}
                    className="vc-opendmbyid-btn"
                    onClick={openDMByIdModal}
                    aria-label="Ouvrir un DM par ID"
                >
                    <PlusIcon width={16} height={16} />
                </button>
            )}
        </Tooltip>
    );
}

export default definePlugin({
    name: "OpenDMById",
    description:
        "Ajoute un bouton dans l'en-tête de la liste des DMs pour ouvrir une conversation via l'ID d'un utilisateur",
    authors: [Devs.m1000],

    patches: [
        {
            find: '"dm-quick-launcher"===',
            replacement: {
                // Same patch point as pinDms — inject a ref into the section header span
                match: /renderSection(?:",|=).{0,300}?"span",{/,
                replace: "$&ref:e=>$self.setHeaderRef(e),",
            },
        },
    ],

    setHeaderRef(el: HTMLElement | null) {
        if (!el) {
            headerRoot?.unmount();
            headerContainer?.remove();
            headerRoot = null;
            headerContainer = null;
            return;
        }

        // Avoid double-injection if the parent already has the button
        if (el.parentElement?.querySelector(".vc-opendmbyid-container")) return;

        const container = document.createElement("span");
        container.className = "vc-opendmbyid-container";
        el.parentElement?.insertBefore(container, el.nextSibling);

        headerContainer = container;
        headerRoot = createRoot(container);
        headerRoot.render(
            <ErrorBoundary noop>
                <OpenDMButton />
            </ErrorBoundary>,
        );
    },

    stop() {
        headerRoot?.unmount();
        headerContainer?.remove();
        headerRoot = null;
        headerContainer = null;
    },
});
