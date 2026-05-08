import { CspPolicies } from "@main/csp";
import { NativeSettings } from "@main/settings";

const NEEDED = ["connect-src", "img-src", "media-src"];

export function addMediaCsp(_: any, domain: string) {
    const existing = NativeSettings.store.customCspRules[domain] ?? [];
    NativeSettings.store.customCspRules[domain] = [...new Set([...existing, ...NEEDED])];
    // Update in-memory map so next mainFrame load picks it up immediately
    CspPolicies[domain] = [...new Set([...(CspPolicies[domain] ?? []), ...NEEDED])];
}
