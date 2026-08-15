/* global SillyTavern */

// Character Life runtime entry.
// bootstrap.js owns release/version cache busting. Runtime code is organized by
// responsibility under src/ and does not use release-number filenames as UI labels.

const CHARACTER_LIFE_SAFE_MODE = (() => {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        return params.get('cl-safe') === '1' || params.get('character-life-safe') === '1';
    } catch {
        return false;
    }
})();

const SETTINGS_FEATURES = Object.freeze([
    {
        key: 'skills',
        selector: '#character-life-skill-settings',
        title: 'Skill Storage',
        subtitle: 'Indicators, tracking, design, and per-chat enable state',
        icon: 'fa-wand-sparkles',
    },
    {
        key: 'continuity',
        selector: '#character-life-continuity-settings',
        title: 'Continuity Hub',
        subtitle: 'Knowledge, relationships, scenes, chronicle, and progression',
        icon: 'fa-timeline',
    },
    {
        key: 'interface-tools',
        selector: '#character-life-qol-settings',
        title: 'Notifications & Library Tools',
        subtitle: 'Notification UI, position, preview, and bulk NPC management',
        icon: 'fa-bell',
    },
]);

let settingsOrganizerObserver = null;
let settingsOrganizerQueued = false;

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

    const settingsBadge = document.querySelector('#character-life-settings .inline-drawer-header .cl-extension-version');
    if (settingsBadge instanceof Element) {
        if (settingsBadge.dataset.characterLifeVersion !== version) settingsBadge.dataset.characterLifeVersion = version;
        if (settingsBadge.textContent !== `v${version}`) settingsBadge.textContent = `v${version}`;
    }

    for (const name of [
        'CharacterLifeSkills',
        'CharacterLifeSkillToggle',
        'CharacterLifeContinuity',
        'CharacterLifeNotifications',
        'CharacterLifeBulkMove',
    ]) patchReleaseApi(name);

    const director = globalThis.CharacterLifeNpcDirector;
    if (director && typeof director === 'object' && director.extensionVersion !== version) {
        try {
            globalThis.CharacterLifeNpcDirector = Object.freeze({ ...director, extensionVersion: version });
        } catch (error) {
            console.warn("[Character Life's] Could not attach release version to the NPC director API.", error);
        }
    }
}

function settingsStateKey(key) {
    return `character-life:settings-section:${key}`;
}

function restoreSectionState(details, key, fallbackOpen = false) {
    if (!(details instanceof HTMLDetailsElement) || details.dataset.clSettingsStateBound === 'true') return;
    details.dataset.clSettingsStateBound = 'true';
    let saved = null;
    try { saved = globalThis.localStorage?.getItem(settingsStateKey(key)); } catch {}
    if (saved === 'open') details.open = true;
    else if (saved === 'closed') details.open = false;
    else if (fallbackOpen) details.open = true;
    details.addEventListener('toggle', () => {
        try { globalThis.localStorage?.setItem(settingsStateKey(key), details.open ? 'open' : 'closed'); } catch {}
    });
}

function featureSummary(feature) {
    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="cl-settings-summary-icon"><i class="fa-solid ${feature.icon}"></i></span>
        <span class="cl-settings-summary-copy"><strong>${feature.title}</strong><small>${feature.subtitle}</small></span>`;
    return summary;
}

function ensureFeatureShell(panel, feature) {
    if (!(panel instanceof Element)) return null;
    const existing = panel.closest('.cl-settings-feature-shell');
    if (existing instanceof HTMLDetailsElement) {
        existing.dataset.clFeature = feature.key;
        restoreSectionState(existing, `feature:${feature.key}`);
        return existing;
    }

    const shell = document.createElement('details');
    shell.className = 'cl-settings-feature-shell cl-settings-section';
    shell.dataset.clFeature = feature.key;
    const body = document.createElement('div');
    body.className = 'cl-settings-section-body';
    panel.before(shell);
    shell.append(featureSummary(feature), body);
    body.append(panel);
    restoreSectionState(shell, `feature:${feature.key}`);
    return shell;
}

function ensureFeatureSlot(content) {
    let slot = document.getElementById('character-life-feature-settings');
    if (slot) return slot;
    slot = document.createElement('div');
    slot.id = 'character-life-feature-settings';
    slot.className = 'cl-settings-feature-stack';
    const theme = document.getElementById('character-life-css-studio');
    if (theme?.parentElement === content) theme.before(slot);
    else content.append(slot);
    return slot;
}

function organizeSettingsDrawer() {
    settingsOrganizerQueued = false;
    const root = document.getElementById('character-life-settings');
    const content = root?.querySelector('.inline-drawer-content');
    if (!root || !content) return false;

    for (const section of root.querySelectorAll('details[data-cl-settings-section]')) {
        const key = section.dataset.clSettingsSection || 'section';
        restoreSectionState(section, key, key === 'npc-automation');
    }

    const slot = ensureFeatureSlot(content);
    for (const feature of SETTINGS_FEATURES) {
        const panel = root.querySelector(feature.selector);
        if (!panel) continue;
        const shell = ensureFeatureShell(panel, feature);
        if (shell && shell.parentElement !== slot) slot.append(shell);
        else if (shell) slot.append(shell); // append in canonical order without recreating anything
    }

    applyReleaseVersion(root);
    return true;
}

function queueSettingsOrganizer(delay = 0) {
    if (settingsOrganizerQueued) return;
    settingsOrganizerQueued = true;
    setTimeout(() => organizeSettingsDrawer(), delay);
}

function bindSettingsOrganizer() {
    const attach = () => {
        const root = document.getElementById('character-life-settings');
        const content = root?.querySelector('.inline-drawer-content');
        if (!root || !content) return false;

        organizeSettingsDrawer();
        if (!settingsOrganizerObserver) {
            const featureSelector = SETTINGS_FEATURES.map(item => item.selector).join(',');
            settingsOrganizerObserver = new MutationObserver(records => {
                for (const record of records) {
                    for (const node of record.addedNodes) {
                        if (!(node instanceof Element) || node.matches('.cl-settings-feature-shell')) continue;
                        if (node.matches(featureSelector) || node.querySelector?.(featureSelector)) {
                            queueSettingsOrganizer(0);
                            return;
                        }
                    }
                }
            });
            // Deliberately scoped to Character Life's own drawer. Never watch document.body.
            settingsOrganizerObserver.observe(content, { childList: true, subtree: true });
        }
        return true;
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
    else attach();

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-settings .inline-drawer-toggle')) queueSettingsOrganizer(0);
    }, true);

    for (const delay of [80, 300, 900, 1600]) setTimeout(() => {
        if (!attach()) queueSettingsOrganizer(0);
    }, delay);
}

function queueReleaseRefresh() {
    setTimeout(() => {
        applyReleaseVersion(document);
        organizeSettingsDrawer();
    }, 0);
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queueReleaseRefresh, { once: true });
    for (const delay of [0, 200, 800]) setTimeout(() => applyReleaseVersion(document), delay);
}

async function importContinuityNow() {
    const NativeMutationObserver = globalThis.MutationObserver;
    if (typeof NativeMutationObserver !== 'function') {
        await importRelease('../features/continuity-v190.js');
        return;
    }

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
        await importRelease('../features/continuity-v190.js');
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
                queueSettingsOrganizer(0);
                console.info("[Character Life's] Continuity systems loaded after startup.");
            })
            .catch(error => console.error("[Character Life's] continuity systems were skipped safely; legacy feature layers remain loaded.", error));
    }, 120);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
}

applyReleaseVersion(document);

try {
    await importRelease('../core/theme-studio-v171.js');
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
        ['../features/npc-update-cleaner-v172.js', 'Raw NPC update cleanup'],
        ['../features/persistent-media-v172.js', 'Persistent media layer'],
        ['../features/character-life-v172.js', 'Wand enhancer'],
        ['../features/skill-system-v172.js', 'Skill Indication system'],
        ['../features/skill-optional-v172.js', 'Per-chat Skill Indicator switch'],
        ['../features/skill-storage-v181.js', 'Skill Storage presentation layer'],
        ['../features/npc-intelligence-v182.js', 'NPC identity/profile director'],
        ['../features/qol-v183.js', 'Notifications/bulk-move layer'],
        ['../features/npc-profile-builder-v184.js', 'Sparse-profile/full-builder layer'],
    ];

    for (const [path, label] of optionalModules) {
        try {
            await importRelease(path);
        } catch (error) {
            console.error(`[Character Life's] ${label} was skipped safely; previously loaded layers remain available.`, error);
        }
    }
}

bindSettingsOrganizer();
bindReleaseRefresh();
applyReleaseVersion(document);
queueSettingsOrganizer(0);
scheduleContinuityImport();
console.info(`[Character Life's] release v${releaseVersion()} runtime loaded${CHARACTER_LIFE_SAFE_MODE ? ' in safe mode' : ''}.`);
