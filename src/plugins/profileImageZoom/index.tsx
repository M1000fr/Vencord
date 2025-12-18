import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { ImageIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { openImageModal } from "@utils/discord";
import definePlugin from "@utils/types";
import { GuildMemberStore, IconUtils, Menu } from "@webpack/common";

const UserContext: NavContextMenuPatchCallback = (children, { user, guildId }) => {
    if (!user) return;

    const memberAvatar = guildId ? GuildMemberStore.getMember(guildId, user.id)?.avatar : null;
    const avatarUrl = IconUtils.getUserAvatarURL(user, true);

    children.push(
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="zoom-avatar"
                label="Zoom Profile Picture"
                action={() => openImageModal({ url: avatarUrl, width: 512, height: 512 })}
                icon={ImageIcon}
            />
            {memberAvatar && (
                <Menu.MenuItem
                    id="zoom-server-avatar"
                    label="Zoom Server Profile Picture"
                    action={() => {
                        const url = IconUtils.getGuildMemberAvatarURLSimple({
                            userId: user.id,
                            avatar: memberAvatar,
                            guildId: guildId!,
                            canAnimate: true
                        });
                        openImageModal({ url, width: 512, height: 512 });
                    }}
                    icon={ImageIcon}
                />
            )}
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "ProfileImageZoom",
    description: "Allows zooming into user profile images via context menu",
    authors: [Devs.Copilot],
    contextMenus: {
        "user-context": UserContext
    }
});
