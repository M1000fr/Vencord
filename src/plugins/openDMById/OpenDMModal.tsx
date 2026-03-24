/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { HeadingSecondary } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import { NavigationRouter, React, RestAPI, showToast, TextInput, Toasts, useState } from "@webpack/common";

const SNOWFLAKE_RE = /^\d{17,19}$/;
const logger = new Logger("OpenDMById");

async function openDMViaApi(userId: string) {
    try {
        const channel = await RestAPI.post({
            url: "/users/@me/channels",
            body: { recipients: [userId] },
        });
        NavigationRouter.transitionTo(`/channels/@me/${channel.body.id}`);
    } catch (err) {
        logger.error("Failed to open DM:", err);
        showToast("Impossible d'ouvrir la conversation — vérifiez l'ID.", Toasts.Type.FAILURE);
    }
}

function OpenDMModal({ modalProps }: { modalProps: ModalProps; }) {
    const [userId, setUserId] = useState("");
    const isValid = SNOWFLAKE_RE.test(userId);

    function submit() {
        if (!isValid) return;
        openDMViaApi(userId);
        modalProps.onClose();
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold" style={{ flexGrow: 1 }}>
                    Ouvrir un DM par ID
                </BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent>
                <div className={Margins.top16} style={{ marginBottom: 16 }}>
                    <HeadingSecondary className={Margins.bottom8}>User ID</HeadingSecondary>
                    <TextInput
                        value={userId}
                        onChange={setUserId}
                        placeholder="123456789012345678"
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === "Enter") submit();
                        }}
                    />
                    {userId.length > 0 && !isValid && (
                        <Paragraph
                            style={{
                                color: "var(--text-danger)",
                                marginTop: 4,
                                fontSize: 12,
                            }}
                        >
                            ID invalide — doit être un nombre de 17 à 19 chiffres.
                        </Paragraph>
                    )}
                </div>
            </ModalContent>

            <ModalFooter>
                <Flex>
                    <Button variant="secondary" onClick={modalProps.onClose}>
                        Annuler
                    </Button>
                    <Button onClick={submit} disabled={!isValid}>
                        Ouvrir la conversation
                    </Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}

export function openDMByIdModal() {
    openModal(props => <OpenDMModal modalProps={props} />);
}
