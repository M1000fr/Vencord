import { Alerts } from "@webpack/common";

const requestedHosts = new Set<string>();

export async function checkAndRequestImgSrc(imageUrl: string) {
    if (IS_WEB || !imageUrl) return;
    try {
        const host = new URL(imageUrl).host;
        if (requestedHosts.has(host)) return;
        requestedHosts.add(host);

        const allOk = await VencordNative.csp.isDomainAllowed(imageUrl, ["connect-src", "img-src", "media-src"]);
        if (allOk) return;

        await (VencordNative.pluginHelpers as any).Swallow?.addMediaCsp?.(host);

        Alerts.show({
            title: "Swallow — Rechargement requis",
            body: `Médias autorisés depuis ${host}. Rechargez Discord pour afficher les images et vidéos.`,
            confirmText: "Recharger maintenant",
            cancelText: "Plus tard",
            onConfirm: () => location.reload(),
        });
    } catch { /* URL invalide */ }
}

export async function checkAndRequestCsp(apiUrl: string) {
    if (IS_WEB || !apiUrl) return;

    try {
        new URL(apiUrl); // validate the URL
    } catch {
        return;
    }

    if (await VencordNative.csp.isDomainAllowed(apiUrl, ["connect-src"])) return;

    const res = await VencordNative.csp.requestAddOverride(apiUrl, ["connect-src"], "Swallow");
    if (res === "ok") {
        Alerts.show({
            title: "Swallow — Redémarrage requis",
            body: `${new URL(apiUrl).host} a été autorisé. Redémarrez Discord pour appliquer les changements.`,
            confirmText: "Redémarrer maintenant",
            cancelText: "Plus tard",
            onConfirm: relaunch,
        });
    }
}
