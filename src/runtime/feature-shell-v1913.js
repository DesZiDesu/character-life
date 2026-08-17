/* global SillyTavern */

// Character Life v1.9.13 — one NPC-Library visual shell for all Wand products.
// Presentation/coordination only. Skill and Continuity engines keep ownership of
// state, persistence, prompts, rendering data, forms, and feature actions.

const VERSION = '1.9.13';
const SURFACES = Object.freeze({
    library: Object.freeze({
        overlay: '#character-life-overlay',
        manager: '.cl-manager',
        header: '.cl-manager-header',
        launcher: '#character-life-wand-launcher',
        label: 'NPC Library',
        icon: 'fa-address-book',
    }),
    skills: Object.freeze({
        overlay: '#character-life-skills-overlay',
        manager: '.cl-skills-manager',
        header: '.cl-skills-header',
        launcher: '#character-life-skill-storage-launcher, #character-life-open-skill-storage',
        label: 'Skill Storage',
        icon: 'fa-wand-sparkles',
    }),
    continuity: Object.freeze({
        overlay: '#character-life-continuity-overlay',
        manager: '.cl190-manager',
        header: ':scope > header',
        launcher: '#character-life-continuity-launcher, #character-life-open-continuity',
        label: 'Continuity',
        icon: 'fa-timeline',
    }),
});

let refreshTimer = null;
let observer = null;
let bound = false;

const q = (selector, root = document) => root?.querySelector?.(selector) || null;
const qa = (selector, root = document) => [...(root?.querySelectorAll?.(selector) || [])];

function overlayFor(name) {
    return q(SURFACES[name]?.overlay || '');
}

function managerFor(name) {
    const overlay = overlayFor(name);
    return overlay ? q(SURFACES[name].manager, overlay) : null;
}

function headerFor(name) {
    const manager = managerFor(name);
    return manager ? q(SURFACES[name].header, manager) : null;
}

function isOpen(name) {
    return Boolean(overlayFor(name)?.classList.contains('is-open'));
}

function activeProduct() {
    return ['library', 'skills', 'continuity'].find(isOpen) || '';
}

function closeSurface(name) {
    const overlay = overlayFor(name);
    if (!overlay) return false;
    if (name === 'library') {
        try { globalThis.CharacterLifeBulkMove?.cancel?.(); } catch {}
    }
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (name === 'skills') {
        const manager = managerFor('skills');
        if (manager) manager.dataset.mobileView = 'list';
    }
    return true;
}

function closeOthers(keep = '') {
    for (const name of Object.keys(SURFACES)) if (name !== keep) closeSurface(name);
    syncBodyLock();
}

function syncBodyLock() {
    const open = Object.keys(SURFACES).some(isOpen);
    document.body?.classList.toggle('character-life-open', open);
    document.documentElement.classList.toggle('character-life-product-open', open);
}

function productNavMarkup() {
    return Object.entries(SURFACES).map(([name, product]) => `
        <button type="button" data-cl-product="${name}" role="tab" aria-selected="false" tabindex="-1">
            <i class="fa-solid ${product.icon}" aria-hidden="true"></i><span>${product.label}</span>
        </button>`).join('');
}

function createProductNav() {
    const nav = document.createElement('nav');
    nav.className = 'cl-product-nav';
    nav.dataset.clProductNav = '';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Character Life features');
    nav.innerHTML = productNavMarkup();
    return nav;
}

function syncProductNav(nav, owner) {
    for (const button of qa('[data-cl-product]', nav)) {
        const active = button.dataset.clProduct === owner;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        button.tabIndex = active ? 0 : -1;
    }
}

function ensureProductNav(name) {
    const manager = managerFor(name);
    const header = headerFor(name);
    if (!manager || !header) return false;
    let nav = q(':scope > [data-cl-product-nav]', manager);
    if (!nav) {
        nav = createProductNav();
        header.insertAdjacentElement('afterend', nav);
    }
    syncProductNav(nav, name);
    return true;
}

function normalizeSharedHeader(name) {
    if (name === 'library') return;
    const header = headerFor(name);
    if (!header) return;
    header.classList.add('cl-manager-header');

    const mark = q(name === 'skills' ? '.cl-skills-mark' : '.cl190-mark', header);
    if (mark) {
        mark.classList.add('cl-brand-mark');
        if (!mark.querySelector('.fa-feather-pointed')) mark.innerHTML = '<i class="fa-solid fa-feather-pointed"></i>';
    }

    const title = q(name === 'skills' ? '#cl-skills-title' : '#cl190-title', header);
    if (title && title.textContent !== "Character Life's") title.textContent = "Character Life's";
    const kicker = q('small', header);
    if (kicker && kicker.textContent !== 'CHRONICLE REGISTRY') kicker.textContent = 'CHRONICLE REGISTRY';

    const close = q(name === 'skills' ? '[data-cl-skill-close]' : '[data-cl190-close]', header);
    close?.classList.add('menu_button', 'menu_button_icon');
}

function decorateLibrary() {
    const overlay = overlayFor('library');
    const manager = managerFor('library');
    if (!overlay || !manager) return false;
    overlay.dataset.clProductSurface = 'library';
    manager.dataset.clProductManager = 'library';
    ensureProductNav('library');
    return true;
}

function repairSkillPane() {
    const manager = managerFor('skills');
    if (!manager) return false;
    const editing = Boolean(q('[data-cl-skill-form]', manager));
    const selected = Boolean(q('.cl-skill-row.is-active', manager));
    const state = editing ? 'editor' : selected ? 'detail' : 'list';
    manager.dataset.mobileView = state;
    return true;
}

function decorateSkills() {
    const overlay = overlayFor('skills');
    const manager = managerFor('skills');
    if (!overlay || !manager) return false;
    overlay.dataset.clProductSurface = 'skills';
    manager.dataset.clProductManager = 'skills';
    manager.classList.add('cl-manager', 'cl-feature-manager', 'cl-skill-feature-manager');
    normalizeSharedHeader('skills');

    q('.cl-skills-toolbar', manager)?.classList.add('cl-manager-toolbar');
    q('.cl-skill-scope-tabs', manager)?.classList.add('cl-scope-tabs');
    q('.cl-skill-search', manager)?.classList.add('cl-search');
    q('[data-cl-skill-new]', manager)?.classList.add('cl-primary');

    const layout = q('.cl-skills-layout', manager);
    layout?.classList.add('cl-manager-layout');
    q(':scope > aside', layout)?.classList.add('cl-npc-list');
    q(':scope > main', layout)?.classList.add('cl-npc-detail');

    const footer = q(':scope > footer', manager);
    if (footer) {
        footer.classList.add('cl-manager-footer', 'cl-skill-legacy-settings');
        footer.setAttribute('aria-hidden', 'true');
    }

    ensureProductNav('skills');
    repairSkillPane();
    return true;
}

function ensureContinuityLayout(manager) {
    const body = q('.cl190-body', manager);
    if (!body) return null;
    let layout = body.parentElement?.classList.contains('cl-continuity-layout') ? body.parentElement : null;
    if (!layout) {
        layout = document.createElement('div');
        layout.className = 'cl-manager-layout cl-continuity-layout';
        body.before(layout);
        layout.append(body);
    }
    layout.classList.add('cl-manager-layout', 'cl-continuity-layout');
    body.classList.add('cl-npc-detail');
    return layout;
}

function decorateContinuity() {
    const overlay = overlayFor('continuity');
    const manager = managerFor('continuity');
    if (!overlay || !manager) return false;
    overlay.dataset.clProductSurface = 'continuity';
    manager.dataset.clProductManager = 'continuity';
    manager.classList.add('cl-manager', 'cl-feature-manager', 'cl-continuity-feature-manager');
    normalizeSharedHeader('continuity');

    const tabs = q('.cl190-tabs', manager);
    tabs?.classList.add('cl-manager-toolbar', 'cl-continuity-tabs');
    ensureContinuityLayout(manager);
    ensureProductNav('continuity');
    return true;
}

function decorateAll() {
    refreshTimer = null;
    try {
        decorateLibrary();
        decorateSkills();
        decorateContinuity();
        syncBodyLock();
        document.documentElement.dataset.characterLifeShell = VERSION;
    } catch (error) {
        console.warn("[Character Life's] NPC-style feature shell refresh skipped safely.", error);
    }
}

function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(decorateAll, delay);
}

function ownerOpen(name) {
    if (name === 'skills' && typeof globalThis.CharacterLifeSkills?.open === 'function') {
        globalThis.CharacterLifeSkills.open();
        return true;
    }
    if (name === 'continuity' && typeof globalThis.CharacterLifeContinuity?.open === 'function') {
        globalThis.CharacterLifeContinuity.open();
        return true;
    }
    const launcher = q(SURFACES[name]?.launcher || '');
    if (launcher instanceof HTMLElement) {
        launcher.click();
        return true;
    }
    if (name === 'library') {
        const fallback = q('#character-life-open');
        if (fallback instanceof HTMLElement) { fallback.click(); return true; }
    }
    return false;
}

function openProduct(name) {
    if (!SURFACES[name]) return false;
    if (isOpen(name)) return true;
    closeOthers(name);
    const opened = ownerOpen(name);
    if (opened) {
        scheduleRefresh(0);
        setTimeout(() => scheduleRefresh(0), 40);
        setTimeout(() => scheduleRefresh(0), 140);
    }
    return opened;
}

function launcherIntent(target) {
    if (!target) return '';
    if (target.closest('#character-life-wand-launcher, #character-life-open, #character-life-new')) return 'library';
    if (target.closest('#character-life-skill-storage-launcher, #character-life-open-skill-storage')) return 'skills';
    if (target.closest('#character-life-continuity-launcher, #character-life-open-continuity')) return 'continuity';
    return '';
}

function onClickCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const product = target.closest('[data-cl-product]')?.dataset.clProduct;
    if (SURFACES[product]) {
        event.preventDefault();
        event.stopPropagation();
        openProduct(product);
        return;
    }

    const intent = launcherIntent(target);
    if (intent) closeOthers(intent);

    if (target.closest('#character-life-skills-overlay, #character-life-continuity-overlay')) {
        setTimeout(() => {
            repairSkillPane();
            scheduleRefresh(0);
        }, 0);
    }
    setTimeout(syncBodyLock, 0);
}

function onSubmitCapture(event) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('#character-life-skills-overlay')) setTimeout(() => {
        repairSkillPane();
        scheduleRefresh(0);
    }, 0);
}

function onKeyDown(event) {
    if (event.key === 'Escape') {
        const active = activeProduct();
        if (active) {
            event.preventDefault();
            closeSurface(active);
            syncBodyLock();
        }
        return;
    }

    const button = event.target instanceof Element ? event.target.closest('[data-cl-product]') : null;
    if (!(button instanceof HTMLButtonElement) || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const nav = button.closest('[data-cl-product-nav]');
    const buttons = qa('[data-cl-product]', nav);
    if (!buttons.length) return;
    const current = Math.max(0, buttons.indexOf(button));
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowRight' ? (current + 1) % buttons.length : (current - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[index]?.focus?.({ preventScroll: true });
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
        version: VERSION,
        active: activeProduct(),
        library: Boolean(overlayFor('library')),
        skills: Boolean(overlayFor('skills')),
        continuity: Boolean(overlayFor('continuity')),
        productNavs: qa('[data-cl-product-nav]').length,
    });
}

function init() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('submit', onSubmitCapture, true);
    document.addEventListener('keydown', onKeyDown, true);
    bindContextEvents();

    observer = new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleRefresh(20);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    for (const eventName of ['character-life:skills-ready', 'character-life:skill-updated', 'character-life:continuity-updated']) {
        globalThis.addEventListener(eventName, () => scheduleRefresh(20));
    }
    for (const delay of [0, 80, 250, 700, 1500]) setTimeout(decorateAll, delay);

    const api = Object.freeze({ version: VERSION, open: openProduct, close: closeSurface, closeOthers, refresh: decorateAll, health });
    globalThis.CharacterLifeFeatureShell = api;
    globalThis.CharacterLifeUnifiedUi = api;
    globalThis.CharacterLifeUiShell = api;
    globalThis.CharacterLifeToolUi = Object.freeze({
        version: VERSION,
        refresh: decorateAll,
        closeSkills: () => closeSurface('skills'),
        closeContinuity: () => closeSurface('continuity'),
        closeAll: () => { for (const name of Object.keys(SURFACES)) closeSurface(name); syncBodyLock(); },
    });
    globalThis.CharacterLifeMobileUi = Object.freeze({ version: VERSION, repairSkillPane, health });
    console.info(`[Character Life's] NPC-style feature shell v${VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
