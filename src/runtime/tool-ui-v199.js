/* global SillyTavern */

// Character Life v1.9.9 — Skill Storage + Continuity Hub interface shell.
// Presentation/interaction only. Existing persistence, tracking, editing,
// Continuity parsing, relationship, Chronicle, and skill engines remain owners
// of their data. This layer owns reliable close/back/touch behavior and visual
// cohesion with the original Character Life NPC Library.

const CL199_VERSION = '1.9.9';
const SURFACES = Object.freeze({
    library: '#character-life-overlay',
    skills: '#character-life-skills-overlay',
    continuity: '#character-life-continuity-overlay',
});

let initialized = false;
let refreshTimer = null;
let skillObserver = null;
let continuityObserver = null;
let lastFocus = null;

const q = (selector, root = document) => root?.querySelector?.(selector) || null;
const qa = (selector, root = document) => [...(root?.querySelectorAll?.(selector) || [])];

function surface(name) {
    return q(SURFACES[name] || '');
}

function isOpen(name) {
    return Boolean(surface(name)?.classList.contains('is-open'));
}

function bodyLock() {
    const anyOpen = Object.keys(SURFACES).some(isOpen);
    document.body?.classList.toggle('character-life-open', anyOpen);
    document.documentElement.classList.toggle('cl199-tool-open', anyOpen);
}

function launcherFor(name) {
    if (name === 'skills') return q('#character-life-skill-storage-launcher, #character-life-open-skill-storage');
    if (name === 'continuity') return q('#character-life-continuity-launcher, #character-life-open-continuity');
    return q('#character-life-wand-launcher');
}

function rememberFocus(name) {
    const active = document.activeElement;
    lastFocus = active instanceof HTMLElement ? active : launcherFor(name);
}

function restoreFocus(name) {
    const target = lastFocus?.isConnected ? lastFocus : launcherFor(name);
    lastFocus = null;
    setTimeout(() => target?.focus?.({ preventScroll: true }), 0);
}

function hardClose(name, { restore = true } = {}) {
    const overlay = surface(name);
    if (!overlay) return false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeAttribute('data-cl199-open');
    if (name === 'skills') {
        const manager = q('.cl-skills-manager', overlay);
        if (manager) manager.dataset.mobileView = 'list';
    }
    if (name === 'library') {
        try { globalThis.CharacterLifeBulkMove?.cancel?.(); } catch {}
    }
    bodyLock();
    if (restore) restoreFocus(name);
    return true;
}

function closeOthers(keep) {
    for (const name of Object.keys(SURFACES)) if (name !== keep && isOpen(name)) hardClose(name, { restore: false });
    bodyLock();
}

function toolIntent(target) {
    if (!target) return '';
    if (target.closest('#character-life-skill-storage-launcher, #character-life-open-skill-storage')) return 'skills';
    if (target.closest('#character-life-continuity-launcher, #character-life-open-continuity')) return 'continuity';
    if (target.closest('#character-life-wand-launcher')) return 'library';
    return '';
}

function closeIntent(target) {
    if (!target) return '';
    if (target.closest('#character-life-skills-overlay [data-cl-skill-close], #character-life-skills-overlay .cl-skills-backdrop')) return 'skills';
    if (target.closest('#character-life-continuity-overlay [data-cl190-close], #character-life-continuity-overlay .cl190-backdrop')) return 'continuity';
    if (target.closest('#character-life-overlay [data-action="close"], #character-life-overlay .cl-manager-backdrop')) return 'library';
    return '';
}

function ensureSkillBack(manager) {
    let back = q('[data-cl199-skill-back]', manager) || q('[data-cl-skill-mobile-back]', manager);
    if (!back) {
        back = document.createElement('button');
        back.type = 'button';
        back.className = 'cl199-back cl-skill-mobile-back';
        back.dataset.cl199SkillBack = '';
        back.setAttribute('aria-label', 'Back to skill list');
        back.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        q('.cl-skills-header', manager)?.prepend(back);
    } else {
        back.dataset.cl199SkillBack = '';
        back.classList.add('cl199-back');
        back.setAttribute('aria-label', 'Back to skill list');
    }
    return back;
}

function syncSkillMobileView(manager = q('#character-life-skills-overlay .cl-skills-manager')) {
    if (!manager) return;
    const editing = Boolean(q('[data-cl-skill-form]', manager));
    const selected = Boolean(q('.cl-skill-row.is-active', manager));
    if (editing) manager.dataset.mobileView = 'editor';
    else if (selected && manager.dataset.mobileView !== 'list') manager.dataset.mobileView = 'detail';
    else if (!selected) manager.dataset.mobileView = 'list';
}

function goSkillList() {
    const manager = q('#character-life-skills-overlay .cl-skills-manager');
    if (!manager) return;
    manager.dataset.mobileView = 'list';
    const activeScope = q('[data-cl-skill-scope].is-active', manager);
    if (activeScope instanceof HTMLElement) activeScope.click();
    setTimeout(() => { manager.dataset.mobileView = 'list'; q('[data-cl-skill-search]', manager)?.focus?.(); }, 0);
}

function decorateSkill() {
    const overlay = surface('skills');
    if (!overlay) return false;
    overlay.dataset.cl199Tool = 'skills';
    const manager = q('.cl-skills-manager', overlay);
    if (!manager) return false;
    manager.classList.add('cl199-tool-manager', 'cl199-skill-manager', 'cl-skill-storage-manager');
    manager.setAttribute('aria-label', 'Character Life Skill Storage');

    const header = q('.cl-skills-header', manager);
    if (header) {
        header.classList.add('cl199-tool-header');
        const kicker = q('small', header);
        if (kicker && kicker.textContent !== 'CHARACTER LIFE · SKILL ARCHIVE') kicker.textContent = 'CHARACTER LIFE · SKILL ARCHIVE';
        const title = q('#cl-skills-title', header);
        if (title && title.textContent !== 'Skill Storage') title.textContent = 'Skill Storage';
        const close = q('[data-cl-skill-close]', header);
        if (close) {
            close.classList.add('cl199-close');
            close.setAttribute('aria-label', 'Close Skill Storage');
            close.title = 'Close Skill Storage';
        }
    }

    q('.cl-skills-toolbar', manager)?.classList.add('cl199-tool-toolbar');
    q('.cl-skills-layout', manager)?.classList.add('cl199-skill-layout');
    q('[data-cl-skill-list]', manager)?.classList.add('cl199-skill-list');
    q('[data-cl-skill-detail]', manager)?.classList.add('cl199-skill-detail');
    ensureSkillBack(manager);

    for (const tab of qa('[data-cl-skill-scope]', manager)) {
        const active = tab.classList.contains('is-active');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.setAttribute('tabindex', active ? '0' : '-1');
    }
    q('.cl-skill-scope-tabs', manager)?.setAttribute('role', 'tablist');
    syncSkillMobileView(manager);

    if (!skillObserver) {
        skillObserver = new MutationObserver(records => {
            if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleRefresh(0);
        });
        skillObserver.observe(manager, { childList: true, subtree: true });
    }
    return true;
}

function decorateContinuity() {
    const overlay = surface('continuity');
    if (!overlay) return false;
    overlay.dataset.cl199Tool = 'continuity';
    const manager = q('.cl190-manager', overlay);
    if (!manager) return false;
    manager.classList.add('cl199-tool-manager', 'cl199-continuity-manager');
    manager.setAttribute('aria-label', 'Character Life Continuity Hub');

    const header = q(':scope > header', manager);
    if (header) {
        header.classList.add('cl199-tool-header');
        const kicker = q('small', header);
        if (kicker && kicker.textContent !== 'CHARACTER LIFE · CONTINUITY') kicker.textContent = 'CHARACTER LIFE · CONTINUITY';
        const title = q('#cl190-title', header);
        if (title && title.textContent !== 'Continuity Hub') title.textContent = 'Continuity Hub';
        const close = q('[data-cl190-close]', header);
        if (close) {
            close.classList.add('cl199-close');
            close.setAttribute('aria-label', 'Close Continuity Hub');
            close.title = 'Close Continuity Hub';
        }
    }

    const tabs = q('.cl190-tabs', manager);
    if (tabs) {
        tabs.classList.add('cl199-continuity-nav');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Continuity sections');
        for (const tab of qa('[data-cl190-tab]', tabs)) {
            const active = tab.classList.contains('is-active');
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.setAttribute('tabindex', active ? '0' : '-1');
            if (active) tab.dataset.cl199Current = 'true';
            else delete tab.dataset.cl199Current;
        }
    }
    q('.cl190-body', manager)?.classList.add('cl199-continuity-body');

    if (!continuityObserver) {
        continuityObserver = new MutationObserver(records => {
            if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleRefresh(0);
        });
        continuityObserver.observe(manager, { childList: true, subtree: true });
    }
    return true;
}

function syncOpenState() {
    for (const name of ['skills', 'continuity']) {
        const overlay = surface(name);
        if (!overlay) continue;
        if (overlay.classList.contains('is-open')) overlay.dataset.cl199Open = 'true';
        else overlay.removeAttribute('data-cl199-open');
    }
    bodyLock();
}

function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    try {
        decorateSkill();
        decorateContinuity();
        syncOpenState();
    } catch (error) {
        console.warn("[Character Life's] v1.9.9 tool UI refresh skipped safely.", error);
    }
}

function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
}

function activeContinuityTab() {
    return q('#character-life-continuity-overlay [data-cl190-tab].is-active');
}

function focusContinuityTab(step) {
    const tabs = qa('#character-life-continuity-overlay [data-cl190-tab]');
    if (!tabs.length) return;
    const current = Math.max(0, tabs.findIndex(tab => tab.classList.contains('is-active')));
    const next = tabs[(current + step + tabs.length) % tabs.length];
    next?.focus?.({ preventScroll: true });
    next?.click?.();
}

function onPointerUpCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const close = closeIntent(target);
    if (close) {
        event.preventDefault();
        event.stopImmediatePropagation();
        hardClose(close);
        return;
    }
    if (target.closest('#character-life-skills-overlay [data-cl199-skill-back]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        goSkillList();
    }
}

function onClickCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const close = closeIntent(target);
    if (close) {
        event.preventDefault();
        event.stopImmediatePropagation();
        hardClose(close);
        return;
    }

    if (target.closest('#character-life-skills-overlay [data-cl199-skill-back]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        goSkillList();
        return;
    }

    const intent = toolIntent(target);
    if (intent) {
        rememberFocus(intent);
        closeOthers(intent);
        setTimeout(() => {
            scheduleRefresh(0);
            if (intent === 'skills') {
                const manager = q('#character-life-skills-overlay .cl-skills-manager');
                if (manager) manager.dataset.mobileView = 'list';
            }
        }, 0);
        return;
    }

    if (target.closest('#character-life-continuity-overlay [data-cl190-tab]')) {
        setTimeout(() => {
            decorateContinuity();
            activeContinuityTab()?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            q('#character-life-continuity-overlay .cl190-body')?.scrollTo?.({ top: 0, behavior: 'auto' });
        }, 0);
    }

    if (target.closest('#character-life-skills-overlay .cl-skill-row, #character-life-skills-overlay [data-cl-skill-new], #character-life-skills-overlay [data-cl-skill-edit]')) {
        setTimeout(() => {
            const manager = q('#character-life-skills-overlay .cl-skills-manager');
            if (manager && (q('[data-cl-skill-form]', manager) || q('.cl-skill-row.is-active', manager))) {
                manager.dataset.mobileView = q('[data-cl-skill-form]', manager) ? 'editor' : 'detail';
            }
            decorateSkill();
        }, 0);
    }
}

function onKeyDown(event) {
    if (event.key === 'Escape') {
        if (isOpen('continuity')) { event.preventDefault(); hardClose('continuity'); }
        else if (isOpen('skills')) { event.preventDefault(); hardClose('skills'); }
        return;
    }
    if (!isOpen('continuity')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('#character-life-continuity-overlay .cl190-tabs')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); focusContinuityTab(1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); focusContinuityTab(-1); }
}

function bindContextEvents() {
    const context = globalThis.SillyTavern?.getContext?.();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const name of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED']) {
        const type = types[name];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => scheduleRefresh(80));
    }
}

function initialize() {
    if (initialized) return;
    initialized = true;
    try {
        document.documentElement.dataset.clToolUi = CL199_VERSION;
        document.addEventListener('pointerup', onPointerUpCapture, true);
        document.addEventListener('click', onClickCapture, true);
        document.addEventListener('keydown', onKeyDown, true);
        bindContextEvents();
        for (const eventName of ['character-life:skills-ready', 'character-life:continuity-updated', 'character-life:skill-updated']) {
            globalThis.addEventListener(eventName, () => scheduleRefresh(20));
        }
        for (const delay of [0, 120, 450, 1100, 2200]) setTimeout(refresh, delay);
        globalThis.CharacterLifeToolUi = Object.freeze({
            version: CL199_VERSION,
            refresh,
            closeSkills: () => hardClose('skills'),
            closeContinuity: () => hardClose('continuity'),
            closeAll: () => {
                hardClose('skills', { restore: false });
                hardClose('continuity', { restore: false });
                hardClose('library', { restore: false });
                bodyLock();
            },
        });
        console.info("[Character Life's] v1.9.9 Skill Storage + Continuity UI shell enabled.");
    } catch (error) {
        initialized = false;
        console.error("[Character Life's] v1.9.9 tool UI shell failed safely.", error);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
