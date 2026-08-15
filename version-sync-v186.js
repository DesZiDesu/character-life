/* global SillyTavern */

// Character Life v1.8.6 — authoritative extension-version synchronizer.
// Historical feature modules keep their own implementation/protocol versions,
// but every user-facing extension badge and public extension-level API reports
// the installed release version from this final compatibility layer.

const EXTENSION_VERSION = '1.8.6';
const VERSION_CLASS = 'cl-extension-version';
const VERSION_STYLE_ID = 'character-life-version-v186-style';
let observer = null;
let syncQueued = false;

function ensureStyle() {
    if (document.getElementById(VERSION_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = VERSION_STYLE_ID;
    style.textContent = `
        #character-life-settings .inline-drawer-header .${VERSION_CLASS} {
            margin-left: .3em;
            font-size: .78em;
            font-weight: 400;
            opacity: .62;
        }
        #character-life-skill-settings .cl-skill-settings-heading > .${VERSION_CLASS} {
            font-size: .72em;
            font-weight: 600;
            letter-spacing: .08em;
            opacity: .72;
        }
    `;
    document.head.appendChild(style);
}

function replaceNode(node, tagName) {
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

    // Older layers target this exact <small> selector and can force v1.8.1/v1.8.2.
    // Replace it with a span so those historical selectors no longer own the badge.
    const legacyMain = document.querySelector('#character-life-settings .inline-drawer-header small');
    if (legacyMain) replaceNode(legacyMain, 'span');
    const main = document.querySelector(`#character-life-settings .inline-drawer-header .${VERSION_CLASS}`);
    if (main && main.textContent !== `v${EXTENSION_VERSION}`) main.textContent = `v${EXTENSION_VERSION}`;

    // The v1.8.2 director targets the Skill Storage heading's direct <span>.
    // Replace only that version node with <small>; normal setting labels are untouched.
    const legacySkill = document.querySelector('#character-life-skill-settings .cl-skill-settings-heading > span');
    if (legacySkill) replaceNode(legacySkill, 'small');
    const skill = document.querySelector(`#character-life-skill-settings .cl-skill-settings-heading > .${VERSION_CLASS}`);
    if (skill && skill.textContent !== `v${EXTENSION_VERSION}`) skill.textContent = `v${EXTENSION_VERSION}`;

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
    try {
        globalThis[name] = Object.freeze({ ...api, version: EXTENSION_VERSION, extensionVersion: EXTENSION_VERSION });
    } catch (error) {
        console.warn(`[Character Life's] Could not synchronize ${name} version.`, error);
    }
}

function syncPublicVersions() {
    globalThis.CharacterLifeVersion = EXTENSION_VERSION;
    patchPublicApi('CharacterLifeSkills');
    patchPublicApi('CharacterLifeSkillToggle');

    const director = globalThis.CharacterLifeNpcDirector;
    if (director && typeof director === 'object' && director.extensionVersion !== EXTENSION_VERSION) {
        try {
            globalThis.CharacterLifeNpcDirector = Object.freeze({ ...director, extensionVersion: EXTENSION_VERSION });
        } catch (error) {
            console.warn("[Character Life's] Could not attach the extension version to the NPC director API.", error);
        }
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
        source.on(type, queueSync);
    }
}

function init() {
    ensureStyle();
    syncPublicVersions();
    syncBadges();
    bindContextEvents();

    // Observe only added/removed UI nodes. Version text mutations are ignored,
    // preventing feedback loops with historical observers.
    observer = new MutationObserver(mutations => {
        if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) queueSync();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', queueSync, true);
    globalThis.addEventListener('character-life:skills-ready', () => {
        syncPublicVersions();
        queueSync();
    });

    console.info(`[Character Life's] v${EXTENSION_VERSION} version synchronization active.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
