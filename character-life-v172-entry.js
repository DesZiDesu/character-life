/* global SillyTavern */

// Character Life runtime entry.
// The installed release version comes ONLY from manifest.json. Historical module
// filenames identify feature generations, not the installed extension release.

let characterLifeReleaseVersion = 'unknown';
const CHARACTER_LIFE_SAFE_MODE = (() => {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        return params.get('cl-safe') === '1' || params.get('character-life-safe') === '1';
    } catch {
        return false;
    }
})();

function releaseVersion() {
    return globalThis.CharacterLifeVersion || characterLifeReleaseVersion || 'unknown';
}

function patchReleaseApi(name) {
    const version = releaseVersion();
    const api = globalThis[name];
    if (!api || typeof api !== 'object' || version === 'unknown') return;
    if (api.version === version && api.extensionVersion === version) return;
    try {
        globalThis[name] = Object.freeze({ ...api, version, extensionVersion: version });
    } catch (error) {
        console.warn(`[Character Life's] Could not attach release version to ${name}.`, error);
    }
}

function applyReleaseVersion(root = document) {
    const version = releaseVersion();
    if (!version || version === 'unknown') return;

    document.documentElement.dataset.characterLifeVersion = version;

    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    for (const node of scope.querySelectorAll('[data-character-life-version], .cl-extension-version')) {
        if (!(node instanceof Element)) continue;
        if (node.dataset.characterLifeVersion !== version) node.dataset.characterLifeVersion = version;
        if (node.classList.contains('cl-extension-version') && node.textContent !== `v${version}`) node.textContent = `v${version}`;
    }

    // Older feature modules created this badge before release-level versioning existed.
    // Normalize it in place without any page-wide version observer.
    const skillBadge = document.querySelector('#character-life-skill-settings .cl-skill-settings-heading > span');
    if (skillBadge instanceof Element) {
        skillBadge.classList.add('cl-extension-version');
        if (skillBadge.dataset.characterLifeVersion !== version) skillBadge.dataset.characterLifeVersion = version;
        if (skillBadge.textContent !== `v${version}`) skillBadge.textContent = `v${version}`;
    }

    const continuityHeading = document.querySelector('#character-life-continuity-overlay .cl190-manager > header small');
    if (continuityHeading && continuityHeading.textContent !== `CHARACTER LIFE v${version}`) continuityHeading.textContent = `CHARACTER LIFE v${version}`;

    globalThis.CharacterLifeVersion = version;
    for (const name of ['CharacterLifeSkills', 'CharacterLifeSkillToggle', 'CharacterLifeContinuity']) patchReleaseApi(name);

    const director = globalThis.CharacterLifeNpcDirector;
    if (director && typeof director === 'object' && director.extensionVersion !== version) {
        try {
            globalThis.CharacterLifeNpcDirector = Object.freeze({ ...director, extensionVersion: version });
        } catch (error) {
            console.warn("[Character Life's] Could not attach the release version to the NPC director API.", error);
        }
    }
}

async function loadReleaseVersion() {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 1800) : null;
    try {
        const response = await fetch(new URL('./manifest.json', import.meta.url), {
            cache: 'no-store',
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
        const manifest = await response.json();
        const version = String(manifest?.version || '').trim();
        if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('manifest version is missing or invalid');
        characterLifeReleaseVersion = version;
        globalThis.CharacterLifeVersion = version;
    } catch (error) {
        if (error?.name !== 'AbortError') console.error("[Character Life's] Could not read the release version from manifest.json.", error);
    } finally {
        if (timeout) clearTimeout(timeout);
    }

    const releaseApi = {
        get version() { return releaseVersion(); },
        get safeMode() { return CHARACTER_LIFE_SAFE_MODE; },
        apply(root = document) { applyReleaseVersion(root); },
    };
    globalThis.CharacterLifeRelease = Object.freeze(releaseApi);
    applyReleaseVersion(document);
}

function queueReleaseRefresh() {
    setTimeout(() => applyReleaseVersion(document), 0);
}

function bindReleaseRefresh() {
    const context = globalThis.SillyTavern?.getContext?.();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (source?.on) {
        const seen = new Set();
        for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED']) {
            const type = types[key];
            if (!type || seen.has(type)) continue;
            seen.add(type);
            source.on(type, queueReleaseRefresh);
        }
    }

    globalThis.addEventListener('character-life:skills-ready', queueReleaseRefresh);
    globalThis.addEventListener('character-life:continuity-updated', queueReleaseRefresh);
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-settings, #character-life-skill-settings, #character-life-continuity-settings, #extensionsMenuButton')) queueReleaseRefresh();
    }, true);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueReleaseRefresh, { once: true });
    for (const delay of [0, 200, 800]) setTimeout(() => applyReleaseVersion(document), delay);
}

async function importContinuityNow() {
    const NativeMutationObserver = globalThis.MutationObserver;
    if (typeof NativeMutationObserver !== 'function') {
        await import('./continuity-v190.js');
        return;
    }

    // The v1.9 Continuity Hub needs a DOM observer only to discover SillyTavern's
    // settings/menu containers. Its own overlay rendering must never feed back into
    // that observer. This filtered observer is captured by continuity-v190.js while
    // it initializes, then the browser's native constructor is restored immediately.
    class CharacterLifeContinuityObserver extends NativeMutationObserver {
        constructor(callback) {
            super((records, observer) => {
                const filtered = records.filter(record => {
                    const target = record.target instanceof Element ? record.target : record.target?.parentElement;
                    return !target?.closest?.('#character-life-continuity-overlay');
                });
                if (filtered.length) callback(filtered, observer);
            });
        }
    }

    try {
        globalThis.MutationObserver = CharacterLifeContinuityObserver;
        await import('./continuity-v190.js');
    } finally {
        globalThis.MutationObserver = NativeMutationObserver;
    }
}

function scheduleContinuityImport() {
    if (CHARACTER_LIFE_SAFE_MODE) {
        console.warn("[Character Life's] Safe mode active: Continuity and optional enhancement modules are disabled for this page load.");
        return;
    }

    // Critical startup rule: NEVER await DOMContentLoaded from the extension module.
    // A module that waits for DOMContentLoaded can itself delay DOMContentLoaded on
    // some browsers. Schedule Continuity after DOM readiness instead, so SillyTavern
    // startup cannot be blocked by this optional subsystem.
    const run = () => setTimeout(() => {
        void importContinuityNow()
            .then(() => {
                applyReleaseVersion(document);
                console.info("[Character Life's] Continuity systems loaded after startup.");
            })
            .catch(error => console.error("[Character Life's] v1.9 continuity systems were skipped safely; legacy feature layers remain loaded.", error));
    }, 120);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
}

// Version discovery is intentionally non-blocking. Character Life's core must load
// even if a browser/server cache delays manifest.json.
void loadReleaseVersion();

// Load the known-good Character Life core first.
try {
    await import('./theme-studio-v171.js');
} catch (error) {
    console.error("[Character Life's] Core/theme loader failed.", error);
}

try {
    const saver = globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced;
    if (typeof saver === 'function' && typeof saver.flush !== 'function') {
        Object.defineProperty(saver, 'flush', {
            configurable: true,
            value: async () => {
                const module = await import('/script.js');
                if (typeof module.saveSettings !== 'function') throw new Error('SillyTavern saveSettings() is unavailable.');
                return module.saveSettings();
            },
        });
    }
} catch (error) {
    console.error("[Character Life's] Immediate settings-save hook was skipped safely.", error);
}

if (!CHARACTER_LIFE_SAFE_MODE) {
    try {
        await import('./npc-update-cleaner-v172.js');
    } catch (error) {
        console.error("[Character Life's] Raw NPC update cleanup was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./persistent-media-v172.js');
    } catch (error) {
        console.error("[Character Life's] Persistent media layer was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./character-life-v172.js');
    } catch (error) {
        console.error("[Character Life's] Wand enhancer was skipped safely; the recovered Character Life core remains loaded.", error);
    }

    try {
        await import('./skill-system-v172.js');
    } catch (error) {
        console.error("[Character Life's] Skill Indication system was skipped safely; the recovered Character Life core remains loaded.", error);
    }

    try {
        await import('./skill-optional-v172.js');
    } catch (error) {
        console.error("[Character Life's] Per-chat Skill Indicator switch was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./skill-storage-v181.js');
    } catch (error) {
        console.error("[Character Life's] Skill Storage presentation layer was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./npc-intelligence-v182.js');
    } catch (error) {
        console.error("[Character Life's] v1.8.2 NPC identity/profile director was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./qol-v183.js');
    } catch (error) {
        console.error("[Character Life's] v1.8.3 notifications/bulk-move layer was skipped safely; the core remains loaded.", error);
    }

    try {
        await import('./npc-profile-builder-v184.js');
    } catch (error) {
        console.error("[Character Life's] v1.8.4 sparse-profile/full-builder layer was skipped safely; the core remains loaded.", error);
    }
}

bindReleaseRefresh();
applyReleaseVersion(document);
scheduleContinuityImport();
console.info(`[Character Life's] release v${releaseVersion()} runtime loaded${CHARACTER_LIFE_SAFE_MODE ? ' in safe mode' : ''}.`);
