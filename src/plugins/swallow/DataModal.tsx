import { openUserProfile } from "@utils/discord";
import { useAwaiter } from "@utils/react";
import {
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import { Button, ChannelStore, Forms, GuildStore, NavigationRouter, TabBar, Text, TextInput, useRef, useState } from "@webpack/common";
import ErrorBoundary from "@components/ErrorBoundary";

import {
    AttachmentsPage,
    MessagesPage,
    TimeTogetherPage,
    VoiceStateEvent,
    VoiceStatesPage,
    searchAttachments,
    searchTimeTogether,
    searchUserMessages,
    searchVoiceStates,
} from "./api";
import { checkAndRequestImgSrc } from "./csp";

const enum Tab {
    Messages = "messages",
    Attachments = "attachments",
    VoiceStates = "voiceStates",
    TimeTogether = "timeTogether",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function channelLabel(channelId: string) {
    const ch = ChannelStore.getChannel(channelId);
    return ch?.name ? `#${ch.name}` : channelId;
}

function guildLabel(guildId?: string) {
    if (!guildId) return "DM";
    return GuildStore.getGuild(guildId)?.name ?? guildId;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDuration(ms: number) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
    padding: "8px 4px",
    borderBottom: "1px solid var(--background-modifier-accent)",
};

const metaStyle: React.CSSProperties = {
    color: "var(--text-muted)",
    fontSize: "11px",
    marginBottom: "2px",
};

const mentionStyle: React.CSSProperties = {
    background: "var(--mention-background, hsl(235,85.6%,64.7%,0.3))",
    color: "var(--mention-foreground, hsl(235,85.6%,64.7%))",
    borderRadius: "3px",
    padding: "0 3px",
    cursor: "pointer",
    fontWeight: 500,
};

function ChannelMention({ channelId, name, guildId }: { channelId: string; name?: string; guildId?: string; }) {
    const ch = ChannelStore.getChannel(channelId);
    const displayName = name ?? ch?.name ?? channelId;
    const resolvedGuildId = guildId ?? ch?.guild_id;
    return (
        <span
            role="button"
            style={mentionStyle}
            onClick={() => NavigationRouter.transitionTo(`/channels/${resolvedGuildId ?? "@me"}/${channelId}`)}
        >
            #{displayName}
        </span>
    );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, pending, onChange }: {
    page: number; totalPages: number; pending: boolean; onChange(p: number): void;
}) {
    if (totalPages <= 0) return null;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 4px 4px" }}>
            <Button size={Button.Sizes.SMALL} disabled={page <= 1 || pending} onClick={() => onChange(page - 1)}>◀</Button>
            <Text variant="text-sm/normal">Page {page} / {totalPages}</Text>
            <Button size={Button.Sizes.SMALL} disabled={page >= totalPages || pending} onClick={() => onChange(page + 1)}>▶</Button>
        </div>
    );
}

// ── Tab: Messages ─────────────────────────────────────────────────────────────

function MessagesTab({ userId }: { userId: string; }) {
    const [page, setPage] = useState(1);
    const [pendingSearch, setPendingSearch] = useState("");
    const [search, setSearch] = useState("");

    const [data, error, pending] = useAwaiter<MessagesPage | null>(
        () => searchUserMessages(userId, page, search),
        { fallbackValue: null, deps: [userId, page, search] }
    );

    const totalPages = data ? Math.ceil(data.total / 20) : 0;

    function applySearch() { setSearch(pendingSearch); setPage(1); }

    return (
        <div>
            <div style={{ display: "flex", gap: "8px", padding: "8px 4px" }}>
                <TextInput style={{ flex: 1 }} placeholder="Search content..." value={pendingSearch}
                    onChange={setPendingSearch} onKeyDown={e => e.key === "Enter" && applySearch()} />
                <Button size={Button.Sizes.SMALL} onClick={applySearch}>Search</Button>
            </div>
            {pending && <Forms.FormText style={{ padding: "4px" }}>Loading...</Forms.FormText>}
            {!pending && error && <Forms.FormText style={{ color: "var(--status-danger)", padding: "4px" }}>Error: {String(error)}</Forms.FormText>}
            {!pending && !error && data?.data.length === 0 && <Forms.FormText style={{ padding: "4px" }}>No messages found.</Forms.FormText>}
            {!pending && !error && data?.data.map(msg => (
                <div key={msg.messageId} style={rowStyle}>
                    <div style={metaStyle}>
                        {guildLabel(msg.guildId)} · <ChannelMention channelId={msg.channelId} guildId={msg.guildId} /> · {new Date(msg.createdAt).toLocaleString()}
                        {msg.isPinned ? " 📌" : ""}
                        {msg.attachmentCount > 0 ? ` 📎 ${msg.attachmentCount}` : ""}
                    </div>
                    <Text variant="text-sm/normal" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {msg.content || <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No content</span>}
                    </Text>
                </div>
            ))}
            <Pagination page={page} totalPages={totalPages} pending={pending} onChange={setPage} />
        </div>
    );
}

// ── Tab: Attachments ──────────────────────────────────────────────────────────

function VideoAttachment({ url }: { url: string; }) {
    const [errored, setErrored] = useState(false);

    if (errored) {
        return (
            <div
                role="button"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    marginBottom: "4px",
                    background: "var(--background-secondary)",
                    borderRadius: "4px",
                    cursor: "pointer",
                }}
                onClick={() => VencordNative.native.openExternal(url)}
            >
                <Text variant="text-sm/normal">▶ Open video externally</Text>
            </div>
        );
    }

    return (
        <video
            src={url}
            controls
            style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "4px", marginBottom: "4px", display: "block" }}
            onError={() => setErrored(true)}
        />
    );
}

function AttachmentsTab({ userId }: { userId: string; }) {
    const [page, setPage] = useState(1);

    const [data, error, pending] = useAwaiter<AttachmentsPage | null>(
        () => searchAttachments(userId, page),
        {
            fallbackValue: null,
            deps: [userId, page],
            onSuccess: data => {
                const url = data?.data.find(a => a.url)?.url;
                if (url) checkAndRequestImgSrc(url);
            },
        }
    );

    const totalPages = data ? Math.ceil(data.total / 20) : 0;

    return (
        <div style={{ paddingTop: "8px" }}>
            {pending && <Forms.FormText style={{ padding: "4px" }}>Loading...</Forms.FormText>}
            {!pending && error && <Forms.FormText style={{ color: "var(--status-danger)", padding: "4px" }}>Error: {String(error)}</Forms.FormText>}
            {!pending && !error && data?.data.length === 0 && <Forms.FormText style={{ padding: "4px" }}>No attachments found.</Forms.FormText>}
            {!pending && !error && data?.data.map(att => {
                const isImage = att.contentType?.startsWith("image/");
                const isVideo = att.contentType?.startsWith("video/");
                return (
                    <div key={att.attachmentId} style={rowStyle}>
                        <div style={metaStyle}>
                            {att.guild?.name ?? "DM"} · <ChannelMention channelId={att.channel.id} name={att.channel.name} guildId={att.guild?.id} /> · {new Date(att.timestamp).toLocaleString()}
                        </div>
                        {isImage && (
                            <img
                                src={att.url}
                                alt={att.name}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "200px",
                                    borderRadius: "4px",
                                    marginBottom: "4px",
                                    display: "block",
                                    cursor: "pointer",
                                }}
                                onClick={() => VencordNative.native.openExternal(att.url)}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                        )}
                        {isVideo && <VideoAttachment url={att.url} />}
                        <Text variant="text-sm/normal">{att.name}</Text>
                        <div style={{ ...metaStyle, marginBottom: 0, marginTop: "2px" }}>
                            {att.contentType ?? "unknown"} · {formatBytes(att.size)}
                            {att.width && att.height ? ` · ${att.width}×${att.height}` : ""}
                        </div>
                    </div>
                );
            })}
            <Pagination page={page} totalPages={totalPages} pending={pending} onChange={setPage} />
        </div>
    );
}

// ── Tab: Voice States ─────────────────────────────────────────────────────────

function VoiceEventDisplay({ vs }: { vs: VoiceStateEvent; }) {
    const ch = vs.channel;
    const old = vs.oldChannel;
    const guildId = vs.guild.id;

    const flags: string[] = [];
    if (vs.selfMute || vs.serverMute) flags.push("🔇");
    if (vs.selfDeaf || vs.serverDeaf) flags.push("🔕");
    if (vs.streaming) flags.push("🎥");
    if (vs.selfVideo) flags.push("📷");
    const flagStr = flags.length ? `  ${flags.join(" ")}` : "";

    let action: React.ReactNode;
    if (ch && !old) action = <>→ <ChannelMention channelId={ch.id} name={ch.name} guildId={guildId} /></>;
    else if (!ch && old) action = <>← <ChannelMention channelId={old.id} name={old.name} guildId={guildId} /></>;
    else if (ch && old) action = <><ChannelMention channelId={old.id} name={old.name} guildId={guildId} /> → <ChannelMention channelId={ch.id} name={ch.name} guildId={guildId} /></>;
    else action = <>—</>;

    return <Text variant="text-sm/normal">{action}{flagStr}</Text>;
}

function VoiceStatesTab({ userId }: { userId: string; }) {
    const [page, setPage] = useState(1);

    const [data, error, pending] = useAwaiter<VoiceStatesPage | null>(
        () => searchVoiceStates(userId, page),
        { fallbackValue: null, deps: [userId, page] }
    );

    const totalPages = data ? Math.ceil(data.total / 20) : 0;

    return (
        <div style={{ paddingTop: "8px" }}>
            {pending && <Forms.FormText style={{ padding: "4px" }}>Loading...</Forms.FormText>}
            {!pending && error && <Forms.FormText style={{ color: "var(--status-danger)", padding: "4px" }}>Error: {String(error)}</Forms.FormText>}
            {!pending && !error && data?.data.length === 0 && <Forms.FormText style={{ padding: "4px" }}>No voice state events found.</Forms.FormText>}
            {!pending && !error && data?.data.map((vs, i) => (
                <div key={i} style={rowStyle}>
                    <div style={metaStyle}>
                        {vs.guild.name} · {new Date(vs.timestamp).toLocaleString()}
                    </div>
                    <VoiceEventDisplay vs={vs} />
                </div>
            ))}
            <Pagination page={page} totalPages={totalPages} pending={pending} onChange={setPage} />
        </div>
    );
}

// ── Tab: Time Together ────────────────────────────────────────────────────────

function TimeTogetherTab({ userId }: { userId: string; }) {
    const [days, setDays] = useState<7 | 30 | 90>(30);
    const [page, setPage] = useState(1);

    const [data, error, pending] = useAwaiter<TimeTogetherPage | null>(
        () => searchTimeTogether(userId, days, page),
        { fallbackValue: null, deps: [userId, days, page] }
    );

    const totalPages = data ? Math.ceil(data.total / 20) : 0;
    const offset = (page - 1) * 20;

    function handleDayChange(d: 7 | 30 | 90) { setDays(d); setPage(1); }

    return (
        <div>
            <div style={{ display: "flex", gap: "6px", padding: "8px 4px", alignItems: "center" }}>
                <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>Period:</Text>
                {([7, 30, 90] as const).map(d => (
                    <Button key={d} size={Button.Sizes.SMALL}
                        color={days === d ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                        onClick={() => handleDayChange(d)}
                    >{d}d</Button>
                ))}
            </div>
            {pending && <Forms.FormText style={{ padding: "4px" }}>Loading...</Forms.FormText>}
            {!pending && error && <Forms.FormText style={{ color: "var(--status-danger)", padding: "4px" }}>Error: {String(error)}</Forms.FormText>}
            {!pending && !error && data?.data.length === 0 && <Forms.FormText style={{ padding: "4px" }}>No shared sessions found.</Forms.FormText>}
            {!pending && !error && data?.data.map((tt, i) => (
                <div key={tt.user.id} style={rowStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>
                            <Text tag="span" variant="text-sm/normal" style={{ color: "var(--text-muted)", marginRight: "6px" }}>
                                #{offset + i + 1}
                            </Text>
                            <span
                                role="button"
                                style={mentionStyle}
                                onClick={() => openUserProfile(tt.user.id).catch(() => { })}
                            >
                                @{tt.user.displayName || tt.user.username}
                            </span>
                            {tt.user.displayName && (
                                <Text tag="span" variant="text-xs/normal" style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                                    {tt.user.username}
                                </Text>
                            )}
                        </span>
                        <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>
                            {formatDuration(tt.totalDuration)} · {tt.sessionCount} session{tt.sessionCount !== 1 ? "s" : ""}
                        </Text>
                    </div>
                </div>
            ))}
            <Pagination page={page} totalPages={totalPages} pending={pending} onChange={setPage} />
        </div>
    );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

function DataModal({ modalProps, userId, username }: {
    modalProps: any;
    userId: string;
    username: string;
}) {
    const [tab, setTab] = useState<Tab>(Tab.Messages);
    const scrollRef = useRef<HTMLDivElement>(null);

    function handleTabChange(t: Tab) {
        setTab(t);
        scrollRef.current?.scrollTo({ top: 0 });
    }

    return (
        <ErrorBoundary>
            <ModalRoot {...modalProps} size={ModalSize.LARGE}>
                <ModalHeader>
                    <Text variant="heading-lg/semibold" style={{ flex: 1 }}>{username} — Swallow</Text>
                    <ModalCloseButton onClick={modalProps.onClose} />
                </ModalHeader>
                <ModalContent scrollerRef={scrollRef}>
                    <TabBar type="top" look="brand" selectedItem={tab} onItemSelect={handleTabChange} style={{ marginBottom: "4px" }}>
                        <TabBar.Item id={Tab.Messages}>Messages</TabBar.Item>
                        <TabBar.Item id={Tab.Attachments}>Attachments</TabBar.Item>
                        <TabBar.Item id={Tab.VoiceStates}>Voice States</TabBar.Item>
                        <TabBar.Item id={Tab.TimeTogether}>Time Together</TabBar.Item>
                    </TabBar>
                    {tab === Tab.Messages && <MessagesTab userId={userId} />}
                    {tab === Tab.Attachments && <AttachmentsTab userId={userId} />}
                    {tab === Tab.VoiceStates && <VoiceStatesTab userId={userId} />}
                    {tab === Tab.TimeTogether && <TimeTogetherTab userId={userId} />}
                </ModalContent>
            </ModalRoot>
        </ErrorBoundary>
    );
}

export function openDataModal(userId: string, username: string) {
    openModal(props => <DataModal modalProps={props} userId={userId} username={username} />);
}
