import { settings } from "./settings";

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

export interface ArchivedMessage {
    messageId: string;
    channelId: string;
    guildId?: string;
    authorId: string;
    content: string;
    createdAt: string;
    editedTimestamp?: string;
    attachmentCount: number;
    isPinned: boolean;
}

export interface ApiUser {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    flags: number | null;
}

export interface ApiGuild {
    id: string;
    name: string;
    icon: string;
}

export interface ApiChannel {
    id: string;
    name: string;
    type: number;
}

export interface Attachment {
    attachmentId: string;
    messageId: string;
    author: ApiUser;
    guild?: ApiGuild;
    channel: ApiChannel;
    url: string;
    name: string;
    contentType?: string;
    size: number;
    width?: number;
    height?: number;
    timestamp: string;
}

export interface VoiceStateEvent {
    user: ApiUser;
    member: any;
    guild: ApiGuild;
    channel: ApiChannel | null;
    oldChannel: ApiChannel | null;
    selfMute: boolean;
    selfDeaf: boolean;
    serverMute: boolean;
    serverDeaf: boolean;
    streaming: boolean;
    selfVideo: boolean;
    timestamp: string;
}

export interface TimeTogetherUser {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    flags: number | null;
}

export interface TimeTogether {
    user: TimeTogetherUser;
    member: null;
    totalDuration: number;
    sessionCount: number;
    firstSessionAt: string;
    lastSessionAt: string;
}

export type MessagesPage = PaginatedResponse<ArchivedMessage>;
export type AttachmentsPage = PaginatedResponse<Attachment>;
export type VoiceStatesPage = PaginatedResponse<VoiceStateEvent>;
export type TimeTogetherPage = PaginatedResponse<TimeTogether>;

function baseUrl() {
    return settings.store.apiUrl.replace(/\/$/, "");
}

function authHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.store.apiKey}`,
    };
}

async function post<T>(path: string, body: object): Promise<T> {
    const res = await fetch(`${baseUrl()}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
    }
    return res.json();
}

export function searchUserMessages(userId: string, page: number, contentFilter?: string): Promise<MessagesPage> {
    const filters: object[] = [{ field: "authorId", op: "eq", value: userId }];
    if (contentFilter?.trim())
        filters.push({ field: "content", op: "contains", value: contentFilter.trim() });
    return post("/messages/search", { filters, sort: { field: "createdAt", order: "desc" }, page, limit: 20 });
}

export function searchAttachments(userId: string, page: number): Promise<AttachmentsPage> {
    return post("/attachments/search", {
        filters: [{ field: "authorId", op: "eq", value: userId }],
        sort: { field: "timestamp", order: "desc" },
        page,
        limit: 20,
    });
}

export function searchVoiceStates(userId: string, page: number): Promise<VoiceStatesPage> {
    return post("/voice-states/search", {
        filters: [{ field: "userId", op: "eq", value: userId }],
        sort: { field: "timestamp", order: "desc" },
        page,
        limit: 20,
    });
}

export function searchTimeTogether(userId: string, days: 7 | 30 | 90, page: number): Promise<TimeTogetherPage> {
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return post("/voice-sessions/time-together", {
        filters: [
            { field: "userId", op: "eq", value: userId },
            { field: "joinedAt", op: "between", value: [from.toISOString(), to.toISOString()] },
        ],
        sort: { field: "totalDuration", order: "desc" },
        page,
        limit: 20,
    });
}
