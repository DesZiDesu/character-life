/* global SillyTavern */

// Character Life runtime entry.
// bootstrap.js owns cache busting and manifest version discovery. Historical
// module filenames describe feature generations, not the installed release.

const CHARACTER_LIFE_SAFE_MODE = (() => {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        return params.get('cl-safe') === '1' || params.get('character-life-safe') === '1';
    } catch {
        return false;
    }
})();

function releaseVersion() {
    return String(globalThis.CharacterLifeVersion || globalThis.CharacterLifeBootstrap?.version || 'unknown');
}

function releaseToken() {
    return String(globalThis.CharacterLifeBootstrap?.cacheToken || globalThis.CharacterLifeVersion || Date.now());
}

function releaseModuleUrl(path) {
    const url = new URL(path, import.meta.url);
    url.searchParams.set('clv', releaseToken());
    return url.href;
}

function importRelease(path) {
    return import(releaseModuleUrl(path));
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

    const settingsBadge = document.querySelector('#character-life-settings .inline-drawer-header small, #character-life-settings .inline-drawer-header .cl-extension-version');
    if (settingsBadge instanceof Element) {
        settingsBadge.classList.add('cl-extension-version');
        if (settingsBadge.dataset.characterLifeVersion !== version) settingsBadge.dataset.characterLifeVersion = version;
        if (settingsBadge.textContent !== `v${version}`) settingsBadge.textContent = `v${version}`;
    }

    const skillBadge = document.querySelector('#character-life-skill-settings .cl-skill-settings-heading > span');
    if (skillBadge instanceof Element) {
        skillBadge.classList.add('cl-extension-version');
        if (skillBadge.dataset.characterLifeVersion !== version) skillBadge.dataset.characterLifeVersion = version;
        if (skillBadge.textContent !== `v${version}`) skillBadge.textContent = `v${version}`;
    }

    const continuityHeading = document.querySelector('#character-life-continuity-overlay .cl190-manager > header small');
    if (continuityHeading && continuityHeading.textContent !== `CHARACTER LIFE v${version}`) continuityHeading.textContent = `CHARACTER LIFE v${version}`;

    for (const name of ['CharacterLifeSkills', 'CharacterLifeSkillToggle', 'CharacterLifeContinuity', 'CharacterLifeNotifications', 'CharacterLifeBulkMove']) patchReleaseApi(name);

    const director = globalThis.CharacterLifeNpcDirector;
    if (director && typeof director === 'object' && director.extensionVersion !== version) {
        try {
            globalThis.CharacterLifeNpcDirector = Object.freeze({ ...director, extensionVersion: version });
        } catch (error) {
            console.warn("[Character Life's] Could not attach the release version to the NPC director API.", error);
        }
    }
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

    for (const eventName of ['character-life:skills-ready', 'character-life:continuity-updated', 'character-life:skill-system-toggle']) {
        globalThis.addEventListener(eventName, queueReleaseRefresh);
    }

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-settings, #character-life-skill-settings, #character-life-continuity-settings, #character-life-overlay, #extensionsMenuButton')) queueReleaseRefresh();
    }, true);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueReleaseRefresh, { once: true });
    for (const delay of [0, 200, 800]) setTimeout(() => applyReleaseVersion(document), delay);
}

async function importContinuityNow() {
    const NativeMutationObserver = globalThis.MutationObserver;
    if (typeof NativeMutationObserver !== 'function') {
        await importRelease('./continuity-v190.js');
        return;
    }

    // Continuity only needs page mutations to discover SillyTavern containers.
    // Ignore mutations created by its own overlay so a render can never feed back
    // into another render indefinitely.
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
        await importRelease('./continuity-v190.js');
    } finally {
        globalThis.MutationObserver = NativeMutationObserver;
    }
}

function scheduleContinuityImport() {
    if (CHARACTER_LIFE_SAFE_MODE) {
        console.warn("[Character Life's] Safe mode active: Continuity and optional enhancement modules are disabled for this page load.");
        return;
    }

    const run = () => setTimeout(() => {
        void importContinuityNow()
            .then(() => {
                applyReleaseVersion(document);
                console.info("[Character Life's] Continuity systems loaded after startup.");
            })
            .catch(error => console.error("[Character Life's] v1.9 continuity systems were skipped safely; legacy feature layers remain loaded.", error));
    }, 120);

    // Never await DOMContentLoaded from module evaluation. Optional Continuity is
    // scheduled after DOM readiness so SillyTavern startup cannot depend on it.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
}

applyReleaseVersion(document);

// Load the known-good Character Life core first. The release query token makes
// Safari request the current module URL after every manifest version change.
try {
    await importRelease('./theme-studio-v171.js');
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
    const optionalModules = [
        ['./npc-update-cleaner-v172.js', 'Raw NPC update cleanup'],
        ['./persistent-media-v172.js', 'Persistent media layer'],
        ['./character-life-v172.js', 'Wand enhancer'],
        ['./skill-system-v172.js', 'Skill Indication system'],
        ['./skill-optional-v172.js', 'Per-chat Skill Indicator switch'],
        ['./skill-storage-v181.js', 'Skill Storage presentation layer'],
        ['./npc-intelligence-v182.js', 'NPC identity/profile director'],
        ['./qol-v183.js', 'Notifications/bulk-move layer'],
        ['./npc-profile-builder-v184.js', 'Sparse-profile/full-builder layer'],
    ];

    for (const [path, label] of optionalModules) {
        try {
            await importRelease(path);
        } catch (error) {
            console.error(`[Character Life's] ${label} was skipped safely; previously loaded layers remain available.`, error);
        }
    }
}

bindReleaseRefresh();
applyReleaseVersion(document);
scheduleContinuityImport();
console.info(`[Character Life's] release v${releaseVersion()} runtime loaded${CHARACTER_LIFE_SAFE_MODE ? ' in safe mode' : ''}.`);
