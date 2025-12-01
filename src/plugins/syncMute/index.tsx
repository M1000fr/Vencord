/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Button, ChannelStore, FluxDispatcher, Forms, RelationshipStore, TextInput, UserStore, useState } from "@webpack/common";

const logger = new Logger("SyncMute");

const MediaEngineStore = findByPropsLazy("isLocalMute");

// Flag to prevent sending messages when we're applying a mute from a friend
let isApplyingRemoteMute = false;

const settings = definePluginSettings({
    syncedFriends: {
        type: OptionType.STRING,
        description: "",
        default: "",
        hidden: true
    },
    manageFriends: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <ManageFriendsComponent />
    }
});

function ManageFriendsComponent() {
    const [friendIds, setFriendIds] = useState<string>(settings.store.syncedFriends ?? "");
    const allFriends = RelationshipStore.getFriendIDs();
    const currentUser = UserStore.getCurrentUser();

    function handleChange(newValue: string) {
        setFriendIds(newValue);
        settings.store.syncedFriends = newValue;
    }

    function addAllFriends() {
        const ids = allFriends.join(", ");
        setFriendIds(ids);
        settings.store.syncedFriends = ids;
    }

    function clearAll() {
        setFriendIds("");
        settings.store.syncedFriends = "";
    }

    const syncedCount = friendIds
        ? new Set(friendIds.split(",").map(id => id.trim()).filter(Boolean)).size
        : 0;

    return (
        <section>
            <Forms.FormTitle tag="h3">Gestion des Amis Synchronisés</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom8}>
                Sélectionnez les amis avec qui vous souhaitez synchroniser vos mutes vocaux. Quand vous mutez quelqu'un en vocal,
                vos amis sélectionnés recevront un message et muteront automatiquement la même personne.
                De même, vous recevrez leurs notifications de mute.
            </Forms.FormText>
            <Forms.FormText className={Margins.bottom8}>
                <strong>Statut actuel :</strong> {syncedCount > 0 ? `Synchronisation active avec ${syncedCount} ami(s)` : "Synchronisation avec tous vos amis"}
            </Forms.FormText>
            <Forms.FormText className={Margins.bottom8} style={{ fontSize: "12px", opacity: 0.7 }}>
                💡 Entrez les IDs d'utilisateur Discord séparés par des virgules, ou utilisez les boutons ci-dessous.
            </Forms.FormText>
            <TextInput
                type="text"
                value={friendIds}
                onChange={handleChange}
                placeholder="123456789012345678, 987654321098765432"
                className={Margins.bottom8}
            />
            <div style={{ display: "flex", gap: "8px" }}>
                <Button
                    size={Button.Sizes.SMALL}
                    onClick={addAllFriends}
                >
                    Ajouter Tous mes Amis ({allFriends.length})
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    onClick={clearAll}
                >
                    Tout Effacer
                </Button>
            </div>
        </section>
    );
}

export default definePlugin({
    name: "SyncMute",
    description: "Automatically syncs voice mute states with friends. When you mute someone in voice, your friends will also mute them.",
    authors: [Devs.m1000],
    settings,

    flux: {
        MESSAGE_CREATE({ channelId, message, optimistic }: any) {
            // Ignore optimistic messages
            if (optimistic) return;

            const currentUserId = UserStore.getCurrentUser()?.id;

            // If it's our own message, ignore it
            if (message.author.id === currentUserId) return;

            // Check if sender is a friend and is in our sync list
            const relationship = RelationshipStore.getRelationshipType(message.author.id);
            if (relationship !== 1) return; // 1 = FRIEND

            // Check if this friend is in our sync list
            if (!isFriendSynced(message.author.id)) return;

            const content = message.content?.trim();
            if (!content) return;

            // Parse $mute USERID or $unmute USERID commands
            const muteMatch = content.match(/^\$mute\s+(\d{17,20})$/);
            const unmuteMatch = content.match(/^\$unmute\s+(\d{17,20})$/);

            if (muteMatch || unmuteMatch) {
                const targetUserId = muteMatch ? muteMatch[1] : unmuteMatch![1];
                const isMute = !!muteMatch;

                logger.info(`Received ${isMute ? "mute" : "unmute"} request for user ${targetUserId} from friend ${message.author.username}`);

                // Set flag to prevent sending messages when applying remote mute
                isApplyingRemoteMute = true;
                setLocalMute(targetUserId, isMute);
                isApplyingRemoteMute = false;
            }
        },

        AUDIO_TOGGLE_LOCAL_MUTE({ userId }: any) {
            // If we're applying a remote mute, don't send messages to avoid loop
            if (isApplyingRemoteMute) {
                logger.info(`Applying remote mute for user ${userId}, skipping broadcast`);
                return;
            }

            // Wait for the store to update
            setTimeout(() => {
                const muted = MediaEngineStore.isLocalMute(userId);
                logger.info(`User ${userId} mute state changed to: ${muted ? "muted" : "unmuted"}`);

                // Send mute/unmute message to synced friends
                sendMuteMessageToFriends(userId, muted);
            });
        }
    }
});

function isFriendSynced(friendId: string): boolean {
    const syncedFriends = settings.store.syncedFriends?.trim();

    // If no specific friends are set, sync with all friends
    if (!syncedFriends) return true;

    const syncedIds = new Set(
        syncedFriends.split(",").map(id => id.trim()).filter(Boolean)
    );

    return syncedIds.has(friendId);
}

function setLocalMute(userId: string, muted: boolean) {
    try {
        // Dispatch the toggle mute action with the desired state
        FluxDispatcher.dispatch({
            type: "AUDIO_TOGGLE_LOCAL_MUTE",
            userId: userId,
            muted: muted,
            context: "default"
        });

        logger.info(`Applied ${muted ? "mute" : "unmute"} for user ${userId}`);

        // Reset flag after a short delay to ensure the dispatch is processed
        setTimeout(() => {
            isApplyingRemoteMute = false;
        }, 100);
    } catch (error) {
        logger.error(`Failed to ${muted ? "mute" : "unmute"} user ${userId}:`, error);
        isApplyingRemoteMute = false;
    }
}

async function sendMuteMessageToFriends(userId: string, muted: boolean) {
    try {
        const allFriends = RelationshipStore.getFriendIDs();

        // Filter to only synced friends
        const friends = allFriends.filter(friendId => isFriendSynced(friendId));

        if (friends.length === 0) {
            logger.info("No synced friends to notify");
            return;
        }

        const messageContent = muted ? `$mute ${userId}` : `$unmute ${userId}`;

        logger.info(`Sending ${muted ? "mute" : "unmute"} notification for user ${userId} to ${friends.length} synced friend(s)`);

        for (const friendId of friends) {
            try {
                // Get or create DM channel with friend
                const dmChannel = ChannelStore.getDMFromUserId(friendId);

                if (dmChannel) {
                    sendMessage(dmChannel, {
                        content: messageContent
                    });
                    logger.info(`Sent ${messageContent} to friend ${friendId}`);
                }
            } catch (error) {
                logger.error(`Failed to send message to friend ${friendId}:`, error);
            }
        }
    } catch (error) {
        logger.error("Failed to send mute messages to friends:", error);
    }
}

