/* global SillyTavern */

// Character Life v1.9.10 — mobile interaction reliability for Skill Storage
// and Continuity Hub. This is presentation/state-coordination only: it does not
// own or migrate NPC, skill, relationship, Chronicle, scene, or prompt data.

const CL1910_VERSION = '1.9.10';
const MOBILE_QUERY = '(max-width: 760px)';
const SKILL_OVERLAY = '#character-life-skills-overlay';
const CONTINUITY_OVERLAY = '#character-life-continuity-overlay';

let skillObserver = null;
let continuityGesture = null;
let suppressTabClick = null;
let refreshTimer = null;

const q = (selector, root = document) => root?.querySelector?.(selector) || null;

function isMobileLayout() {
    try { return globalThis.matchMedia?.(MOBILE_QUERY)?.matches ?? globalThis.innerWidth <= 760; }
    catch { return globalThis.innerWidth <= 760; }
}

function skillManager() {
    return q(`${SKILL_OVERLAY} .cl-skills-manager`);
}

function repairSkillPane() {
    const manager = skillManager();
    if (!manager) return false;

    const form = q('[data-cl-skill-form]', manager);
    const selected = q('.cl-skill-row.is-active', manager);
    const state = form ? 'editor' : selected ? 'detail' : 'list';
    if (manager.dataset.mobileView !== state) manager.dataset.mobileView = state;
    manager.dataset.cl1910Pane = state;

    const list = q('[data-cl-skill-list]', manager);
    const detail = q('[data-cl-skill-detail]', manager);
    if (list) list.setAttribute('aria-hidden', isMobileLayout() && state !== 'list' ? 'true' : 'false');
    if (detail) detail.setAttribute('aria-hidden', isMobileLayout() && state === 'list' ? 'true' : 'false');

    if (isMobileLayout() && state !== 'list' && detail) {
        // A visible editor/detail pane must never inherit stale list-mode hiding.
        detail.style.removeProperty('display');
        detail.style.removeProperty('visibility');
        detail.style.removeProperty('opacity');
    }
    return true;
}

function ensureSkillObserver() {
    const manager = skillManager();
    if (!manager || skillObserver) return;
    skillObserver = new MutationObserver(records => {
        if (!records.some(record => record.type === 'childList' && (record.addedNodes.length || record.removedNodes.length))) return;
        queueRepair(0);
    });
    skillObserver.observe(manager, { childList: true, subtree: true });
}

function queueRepair(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        refreshTimer = null;
        repairSkillPane();
        ensureSkillObserver();
    }, delay);
}

function continuityTab(target) {
    return target instanceof Element ? target.closest(`${CONTINUITY_OVERLAY} [data-cl190-tab]`) : null;
}

function onPointerDownCapture(event) {
    if (!isMobileLayout() || event.button > 0) return;
    const tab = continuityTab(event.target);
    if (!tab) return;
    continuityGesture = {
        pointerId: event.pointerId,
        tab,
        x: event.clientX,
        y: event.clientY,
    };
}

function onPointerCancelCapture(event) {
    if (continuityGesture?.pointerId === event.pointerId) continuityGesture = null;
}

function onPointerUpCapture(event) {
    if (!isMobileLayout()) return;
    const gesture = continuityGesture;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    continuityGesture = null;

    const tab = continuityTab(event.target) || gesture.tab;
    if (!(tab instanceof HTMLElement) || !tab.isConnected) return;
    const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (moved > 12) return; // horizontal swipe/scroll, not a tap

    event.preventDefault();
    event.stopImmediatePropagation();
    suppressTabClick = { tab: tab.dataset.cl190Tab || '', until: Date.now() + 500 };

    // Programmatic click bypasses Safari's occasional failure to synthesize a
    // click after a touch inside a scrollable/navigation surface. The original
    // Continuity module remains the owner of active-tab state and rendering.
    tab.click();
    requestAnimationFrame(() => {
        const active = q(`${CONTINUITY_OVERLAY} [data-cl190-tab].is-active`);
        active?.focus?.({ preventScroll: true });
        q(`${CONTINUITY_OVERLAY} .cl190-body`)?.scrollTo?.({ top: 0, behavior: 'auto' });
    });
}

function onClickCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const tab = continuityTab(target);
    if (event.isTrusted && tab && suppressTabClick && Date.now() <= suppressTabClick.until
        && (tab.dataset.cl190Tab || '') === suppressTabClick.tab) {
        // The pointer-up bridge already sent the semantic click.
        suppressTabClick = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }
    if (suppressTabClick && Date.now() > suppressTabClick.until) suppressTabClick = null;

    if (target.closest(`${SKILL_OVERLAY} [data-cl-skill-new], ${SKILL_OVERLAY} [data-cl-skill-edit], ${SKILL_OVERLAY} [data-cl-skill-select], ${SKILL_OVERLAY} [data-cl-skill-cancel], ${SKILL_OVERLAY} [data-cl-skill-scope]`)) {
        // The skill engine handles the action synchronously during bubbling.
        // Repair after that render, then once more on the next frame for Safari.
        setTimeout(() => {
            repairSkillPane();
            requestAnimationFrame(repairSkillPane);
        }, 0);
    }
}

function onSubmitCapture(event) {
    if (!(event.target instanceof Element) || !event.target.closest(`${SKILL_OVERLAY} [data-cl-skill-form]`)) return;
    setTimeout(() => requestAnimationFrame(repairSkillPane), 0);
}

function healthSnapshot() {
    return Object.freeze({
        version: CL1910_VERSION,
        core: Boolean(globalThis.CharacterLife || q('#character-life-settings') || q('#character-life-overlay')),
        skills: Boolean(globalThis.CharacterLifeSkills),
        skillToggle: Boolean(globalThis.CharacterLifeSkillToggle),
        continuity: Boolean(globalThis.CharacterLifeContinuity),
        notifications: Boolean(globalThis.CharacterLifeNotifications),
        bulkMove: Boolean(globalThis.CharacterLifeBulkMove),
        reliability: Boolean(globalThis.CharacterLifeReliability),
        toolUi: Boolean(globalThis.CharacterLifeToolUi),
        skillOverlay: Boolean(q(SKILL_OVERLAY)),
        continuityOverlay: Boolean(q(CONTINUITY_OVERLAY)),
    });
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
        source.on(type, () => queueRepair(50));
    }
}

function init() {
    document.documentElement.dataset.characterLifeMobileUi = CL1910_VERSION;
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    document.addEventListener('pointerup', onPointerUpCapture, true);
    document.addEventListener('pointercancel', onPointerCancelCapture, true);
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('submit', onSubmitCapture, true);
    bindContextEvents();

    for (const name of ['character-life:skills-ready', 'character-life:skill-updated', 'character-life:continuity-updated']) {
        globalThis.addEventListener(name, () => queueRepair(20));
    }
    for (const delay of [0, 100, 350, 900, 1800]) setTimeout(() => queueRepair(0), delay);

    globalThis.CharacterLifeMobileUi = Object.freeze({
        version: CL1910_VERSION,
        repairSkillPane,
        health: healthSnapshot,
    });
    console.info(`[Character Life's] mobile UI reliability v${CL1910_VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
