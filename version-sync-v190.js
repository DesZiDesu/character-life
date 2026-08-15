/* global SillyTavern */

// Character Life v1.9.0 — authoritative extension version synchronizer.
const EXTENSION_VERSION = '1.9.0';
const VERSION_CLASS = 'cl-extension-version';
let observer = null;
let syncQueued = false;

function replaceNode(node, tagName = 'span') {
    if (!(node instanceof Element)) return null;
    const replacement = document.createElement(tagName);
    replacement.className = VERSION_CLASS;
    replacement.dataset.characterLifeVersion = EXTENSION_VERSION;
    replacement.textContent = `v${EXTENSION_VERSION}`;
    node.replaceWith(replacement);
    return replacement;
}

function syncBadges() {
    syncQueued = false;
    const legacyMain = document.querySelector('#character-life-settings .inline-drawer-header small');
    if (legacyMain) replaceNode(legacyMain);
    const main = document.querySelector(`#character-life-settings .inline-drawer-header .${VERSION_CLASS}`);
    if (main) { main.dataset.characterLifeVersion = EXTENSION_VERSION; main.textContent = `v${EXTENSION_VERSION}`; }
    const legacySkill = document.querySelector('#character-life-skill-settings .cl-skill-settings-heading > span:not(.cl-extension-version)');
    if (legacySkill) replaceNode(legacySkill, 'small');
    const skill = document.querySelector(`#character-life-skill-settings .cl-skill-settings-heading > .${VERSION_CLASS}`);
    if (skill) { skill.dataset.characterLifeVersion = EXTENSION_VERSION; skill.textContent = `v${EXTENSION_VERSION}`; }
    document.querySelectorAll('[data-character-life-version]').forEach(node => {
        node.dataset.characterLifeVersion = EXTENSION_VERSION;
        if (node.classList.contains(VERSION_CLASS)) node.textContent = `v${EXTENSION_VERSION}`;
    });
    document.documentElement.dataset.characterLifeVersion = EXTENSION_VERSION;
}

function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(syncBadges);
}

function patchPublicApi(name) {
    const api = globalThis[name];
    if (!api || typeof api !== 'object') return;
    try { globalThis[name] = Object.freeze({ ...api, version: EXTENSION_VERSION, extensionVersion: EXTENSION_VERSION }); }
    catch (error) { console.warn(`[Character Life's] Could not synchronize ${name} version.`, error); }
}

function syncPublicVersions() {
    globalThis.CharacterLifeVersion = EXTENSION_VERSION;
    for (const name of ['CharacterLifeSkills', 'CharacterLifeSkillToggle', 'CharacterLifeContinuity']) patchPublicApi(name);
    const director = globalThis.CharacterLifeNpcDirector;
    if (director && typeof director === 'object' && director.extensionVersion !== EXTENSION_VERSION) {
        try { globalThis.CharacterLifeNpcDirector = Object.freeze({ ...director, extensionVersion: EXTENSION_VERSION }); }
        catch (error) { console.warn("[Character Life's] Could not synchronize NPC director version.", error); }
    }
}

function bindContextEvents() {
    const context = globalThis.SillyTavern?.getContext?.();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED']) {
        const type = types[key];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => { syncPublicVersions(); queueSync(); });
    }
}

function init() {
    syncPublicVersions();
    syncBadges();
    bindContextEvents();
    observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) { syncPublicVersions(); queueSync(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', () => { syncPublicVersions(); queueSync(); }, true);
    for (const eventName of ['character-life:skills-ready', 'character-life:continuity-updated']) globalThis.addEventListener(eventName, () => { syncPublicVersions(); queueSync(); });
    console.info(`[Character Life's] v${EXTENSION_VERSION} version synchronization active.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
