/* Character Life permanent bootstrap.
 * Keep this file intentionally tiny and stable. It reads manifest.json with
 * cache disabled, then gives the real runtime and stylesheet a release query
 * token so Safari cannot keep running an older Character Life build.
 */

const MANIFEST_URL = new URL('./manifest.json', import.meta.url);
const RUNTIME_URL = new URL('./character-life-v172-entry.js', import.meta.url);
const STYLE_URL = new URL('./style-v190.css', import.meta.url);

async function readManifest() {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 2500) : null;
    try {
        const response = await fetch(MANIFEST_URL, {
            cache: 'no-store',
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
        return await response.json();
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function validVersion(value) {
    const version = String(value || '').trim();
    return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : '';
}

function installReleaseStyle(cacheToken) {
    const id = 'character-life-release-css';
    const existing = document.getElementById(id);
    const url = new URL(STYLE_URL);
    url.searchParams.set('clv', cacheToken);
    if (existing instanceof HTMLLinkElement && existing.href === url.href) return;
    existing?.remove();
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url.href;
    link.onerror = () => console.error("[Character Life's] Release stylesheet failed to load.");
    document.head.appendChild(link);
}

let manifest = null;
try {
    manifest = await readManifest();
} catch (error) {
    console.warn("[Character Life's] Could not refresh manifest metadata; using a one-time cache token.", error);
}

const releaseVersion = validVersion(manifest?.version);
const cacheToken = releaseVersion || `${Date.now()}`;
if (releaseVersion) globalThis.CharacterLifeVersion = releaseVersion;

globalThis.CharacterLifeBootstrap = Object.freeze({
    version: releaseVersion || 'unknown',
    cacheToken,
});

// CSS must never hold up SillyTavern startup. It loads independently while the
// runtime evaluates; a stylesheet failure therefore cannot trap the loading UI.
installReleaseStyle(cacheToken);

const runtimeUrl = new URL(RUNTIME_URL);
runtimeUrl.searchParams.set('clv', cacheToken);
await import(runtimeUrl.href);
