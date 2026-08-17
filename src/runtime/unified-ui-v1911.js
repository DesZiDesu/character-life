/* global SillyTavern */

// Character Life v1.9.11 — non-destructive unified product navigation.
// The NPC Library, Skill Storage, and Continuity engines keep ownership of
// their own state, persistence, rendering, prompts, and event lifecycles.
// This final layer only presents them as one Character Life interface.

const CL1911_VERSION = '1.9.11';
const TOOLS = Object.freeze({
    library: Object.freeze({
        overlay: '#character-life-overlay',
        header: '.cl-manager-header',
        launcher: '#character-life-wand-launcher',
        label: 'NPC Library',
        icon: 'fa-solid fa-address-book',
    }),
    skills: Object.freeze({
        overlay: '#character-life-skills-overlay',
        header: '.cl-skills-header',
        launcher: '#character-life-skill-storage-launcher, #character-life-open-skill-storage',
        label: 'Skill Storage',
        icon: 'fa-solid fa-wand-sparkles',
    }),
    continuity: Object.freeze({
        overlay: '#character-life-continuity-overlay',
        header: '.cl190-manager > header',
        launcher: '#character-life-continuity-launcher, #character-life-open-continuity',
        label: 'Continuity',
        icon: 'fa-solid fa-timeline',
    }),
});

let refreshTimer = null;
let domObserver = null;

const q = (selector, root = document) => root?.querySelector?.(selector) || null;
const qa = (selector, root = document) => [...(root?.querySelectorAll?.(selector) || [])];

function overlayFor(name) {
    return q(TOOLS[name]?.overlay || '');
}

function headerFor(name) {
    const overlay = overlayFor(name);
    return overlay ? q(TOOLS[name].header, overlay) : null;
}

function managerFor(name) {
    return headerFor(name)?.parentElement || null;
}

function launcherFor(name) {
    return q(TOOLS[name]?.launcher || '');
}

function isAvailable(name) {
    if (!TOOLS[name]) return false;
    if (launcherFor(name) || overlayFor(name)) return true;
    if (name === 'skills') return typeof globalThis.CharacterLifeSkills?.open === 'function';
    if (name === 'continuity') return typeof globalThis.CharacterLifeContinuity?.open === 'function';
    return false;
}

function isOpen(name) {
    return Boolean(overlayFor(name)?.classList.contains('is-open'));
}

function activeTool() {
    for (const name of ['library', 'skills', 'continuity']) if (isOpen(name)) return name;
    return '';
}

function navMarkup() {
    return Object.entries(TOOLS).map(([name, tool]) => `
        <button type="button" data-cl1911-tool="${name}" role="tab" aria-selected="false" tabindex="-1">
            <i class="${tool.icon}" aria-hidden="true"></i>
            <span>${tool.label}</span>
        </button>`).join('');
}

function createNav() {
    const nav = document.createElement('nav');
    nav.className = 'cl1911-product-nav';
    nav.dataset.cl1911Nav = '';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Character Life features');
    nav.innerHTML = navMarkup();

    nav.addEventListener('click', event => {
        const button = event.target instanceof Element ? event.target.closest('[data-cl1911-tool]') : null;
        if (!(button instanceof HTMLButtonElement) || button.disabled) return;
        event.preventDefault();
        event.stopPropagation();
        openTool(button.dataset.cl1911Tool || '');
    });

    nav.addEventListener('keydown', event => {
        const button = event.target instanceof Element ? event.target.closest('[data-cl1911-tool]') : null;
        if (!(button instanceof HTMLButtonElement)) return;
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = qa('[data-cl1911-tool]:not(:disabled)', nav);
        if (!buttons.length) return;
        const current = Math.max(0, buttons.indexOf(button));
        const nextIndex = event.key === 'Home' ? 0
            : event.key === 'End' ? buttons.length - 1
                : event.key === 'ArrowRight' ? (current + 1) % buttons.length
                    : (current - 1 + buttons.length) % buttons.length;
        event.preventDefault();
        buttons[nextIndex]?.focus?.({ preventScroll: true });
    });
    return nav;
}

function syncNav(nav, owner) {
    for (const button of qa('[data-cl1911-tool]', nav)) {
        const name = button.dataset.cl1911Tool || '';
        const available = isAvailable(name);
        const active = name === owner;
        button.disabled = !available;
        button.setAttribute('aria-disabled', available ? 'false' : 'true');
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.classList.toggle('is-active', active);
        button.tabIndex = active ? 0 : -1;
    }
}

function decorateSurface(name) {
    const overlay = overlayFor(name);
    const header = headerFor(name);
    const manager = managerFor(name);
    if (!overlay || !header || !manager) return false;

    overlay.dataset.cl1911Surface = name;
    manager.classList.add('cl1911-unified-manager');
    header.classList.add('cl1911-unified-header');

    let nav = q(':scope > [data-cl1911-nav]', manager);
    if (!nav) {
        nav = createNav();
        header.insertAdjacentElement('afterend', nav);
    }
    syncNav(nav, name);
    return true;
}

function normalizeWandEntry() {
    const launcher = q('#character-life-wand-launcher');
    if (!launcher) return;
    launcher.title = 'Open Character Life';
    launcher.setAttribute('aria-label', 'Open Character Life');
    const label = q('span', launcher);
    if (label) label.textContent = "Character Life's";
}

function markCompatibilityLaunchers() {
    for (const selector of ['#character-life-skill-storage-launcher', '#character-life-continuity-launcher']) {
        const launcher = q(selector);
        if (launcher) launcher.dataset.cl1911CompatibilityLauncher = 'true';
    }
}

function ownerOpen(name) {
    const launcher = launcherFor(name);
    if (launcher instanceof HTMLElement) {
        launcher.click();
        return true;
    }
    if (name === 'skills' && typeof globalThis.CharacterLifeSkills?.open === 'function') {
        globalThis.CharacterLifeSkills.open();
        return true;
    }
    if (name === 'continuity' && typeof globalThis.CharacterLifeContinuity?.open === 'function') {
        globalThis.CharacterLifeContinuity.open();
        return true;
    }
    return false;
}

function openTool(name) {
    if (!TOOLS[name] || !isAvailable(name)) return false;
    if (isOpen(name)) return true;

    // Route through each feature's established launcher/API. Existing capture
    // handlers therefore remain responsible for closing other surfaces, body
    // lock, Bulk Move cancellation, mobile pane reset, and focus semantics.
    const opened = ownerOpen(name);
    if (opened) {
        scheduleRefresh(0);
        setTimeout(() => scheduleRefresh(0), 60);
    }
    return opened;
}

function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    try {
        normalizeWandEntry();
        markCompatibilityLaunchers();
        for (const name of Object.keys(TOOLS)) decorateSurface(name);
        const current = activeTool();
        if (current) {
            for (const nav of qa('[data-cl1911-nav]')) {
                const owner = nav.closest('[data-cl1911-surface]')?.dataset.cl1911Surface || current;
                syncNav(nav, owner);
            }
        }
    } catch (error) {
        console.warn("[Character Life's] v1.9.11 unified UI refresh skipped safely.", error);
    }
}

function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
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
        source.on(type, () => scheduleRefresh(50));
    }
}

function health() {
    return Object.freeze({
        version: CL1911_VERSION,
        active: activeTool(),
        library: Boolean(overlayFor('library')),
        skills: Boolean(globalThis.CharacterLifeSkills || overlayFor('skills')),
        continuity: Boolean(globalThis.CharacterLifeContinuity || overlayFor('continuity')),
        toolUi: Boolean(globalThis.CharacterLifeToolUi),
        mobileUi: Boolean(globalThis.CharacterLifeMobileUi),
        navigationCount: qa('[data-cl1911-nav]').length,
    });
}

function init() {
    document.documentElement.dataset.characterLifeUnifiedUi = CL1911_VERSION;
    bindContextEvents();

    domObserver = new MutationObserver(records => {
        if (!records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
        scheduleRefresh(20);
    });
    if (document.body) domObserver.observe(document.body, { childList: true, subtree: true });

    for (const eventName of ['character-life:skills-ready', 'character-life:continuity-updated', 'character-life:skill-updated']) {
        globalThis.addEventListener(eventName, () => scheduleRefresh(20));
    }
    for (const delay of [0, 80, 250, 700, 1500]) setTimeout(refresh, delay);

    globalThis.CharacterLifeUnifiedUi = Object.freeze({
        version: CL1911_VERSION,
        refresh,
        open: openTool,
        health,
    });
    console.info(`[Character Life's] unified Character Life UI v${CL1911_VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
