/* Character Life permanent bootstrap.
 * Keep this file intentionally tiny and stable. It reads manifest.json with
 * cache disabled, then gives the real runtime and stylesheet a release query
 * token so Safari cannot keep running an older Character Life build.
 */

const MANIFEST_URL = new URL('./manifest.json', import.meta.url);
const RELIABILITY_URL = new URL('./src/runtime/reliability-v196.js', import.meta.url);
const RUNTIME_URL = new URL('./src/runtime/entry.js', import.meta.url);
const NPC_IDENTITY_URL = new URL('./src/runtime/npc-identity-v197.js', import.meta.url);
const UI_COHESION_URL = new URL('./src/runtime/ui-cohesion-v195.js', import.meta.url);
const STYLE_URL = new URL('./styles/style-v190.css', import.meta.url);

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

// Reliability loads before the historical feature stack. This lets it consolidate
// Character Life prompt slots and register continuity replay guards before older
// modules bind their own chat listeners. A failure here is isolated and never
// prevents the established runtime from loading.
const reliabilityUrl = new URL(RELIABILITY_URL);
reliabilityUrl.searchParams.set('clv', cacheToken);
try {
    await import(reliabilityUrl.href);
} catch (error) {
    console.error("[Character Life's] Reliability coordinator failed safely; loading the established runtime.", error);
}

const runtimeUrl = new URL(RUNTIME_URL);
runtimeUrl.searchParams.set('clv', cacheToken);
await import(runtimeUrl.href);

// Canonical NPC identity/scope repair runs after the established runtime exists.
// It is isolated so a migration or presentation issue can never prevent the
// NPC Library, Skill Storage, or Continuity from loading.
const identityUrl = new URL(NPC_IDENTITY_URL);
identityUrl.searchParams.set('clv', cacheToken);
try {
    await import(identityUrl.href);
} catch (error) {
    console.error("[Character Life's] NPC identity/scope repair failed safely; established runtime remains available.", error);
}

// Keep UI safety separate from the feature runtime. If this presentation layer
// fails, the NPC Library, Skill Storage, and Continuity engines remain loaded.
const cohesionUrl = new URL(UI_COHESION_URL);
cohesionUrl.searchParams.set('clv', cacheToken);
try {
    await import(cohesionUrl.href);
} catch (error) {
    console.error("[Character Life's] UI cohesion layer failed safely; core interfaces remain available.", error);
}

// Runtime modules now exist; refresh the consolidated prompt/diagnostics once so
// the first role-play turn does not have to wait for a later chat event.
try { globalThis.CharacterLifeReliability?.refresh?.(); }
catch (error) { console.warn("[Character Life's] Reliability refresh skipped safely.", error); }
