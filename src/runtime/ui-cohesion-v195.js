/* Character Life v1.9.5 — UI cohesion and mobile interaction safety.
 * Keeps NPC Library, Skill Storage, and Continuity as separate tools while
 * preventing stacked full-screen surfaces and providing defensive close/touch
 * handling. No AI calls, storage migrations, or role-play state changes here.
 */

const CL_UI_VERSION = '1.9.5';
const SURFACES = Object.freeze({
    library: '#character-life-overlay',
    skills: '#character-life-skills-overlay',
    continuity: '#character-life-continuity-overlay',
});

function targetElement(event) {
    return event?.target instanceof Element ? event.target : null;
}

function surfaceElement(name) {
    return document.querySelector(SURFACES[name] || '');
}

function isOpen(name) {
    return Boolean(surfaceElement(name)?.classList.contains('is-open'));
}

function resetLocalMode(name) {
    if (name !== 'library') return;
    try { globalThis.CharacterLifeBulkMove?.cancel?.(); }
    catch (error) { console.warn("[Character Life's] Bulk Move reset skipped safely.", error); }
}

function closeSurface(name) {
    const overlay = surfaceElement(name);
    if (!overlay) return false;
    resetLocalMode(name);
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    return true;
}

function closeOthers(keep = '') {
    for (const name of Object.keys(SURFACES)) if (name !== keep) closeSurface(name);
    syncBodyLock();
}

function syncBodyLock() {
    const anyOpen = Object.keys(SURFACES).some(isOpen);
    document.body?.classList.toggle('character-life-open', anyOpen);
}

function removeLegacyEmbeddedSkills() {
    // Skill Storage has had its own Wand entry since v1.8.1. The v1.7.2 skill
    // module can still re-inject this old button after clicks; leaving it alive
    // allows two full-screen overlays to be opened on top of one another.
    document.querySelectorAll('#character-life-overlay [data-cl-open-skills]').forEach(button => button.remove());
}

function polishSurfaceLabels() {
    const bulk = document.querySelector('#character-life-overlay [data-cl-bulk-toggle]');
    if (bulk) {
        bulk.title = 'Bulk Move NPCs';
        bulk.setAttribute('aria-label', 'Bulk Move NPCs');
    }
    const skillKicker = document.querySelector('#character-life-skills-overlay .cl-skills-header small');
    if (skillKicker) skillKicker.textContent = 'CHRONICLE SKILL REGISTRY';
    const continuityKicker = document.querySelector('#character-life-continuity-overlay .cl190-manager > header small');
    if (continuityKicker) continuityKicker.textContent = 'CHRONICLE CONTINUITY';
}

function launcherIntent(target) {
    if (!target) return '';
    if (target.closest('#character-life-wand-launcher')) return 'library';
    if (target.closest('#character-life-skill-storage-launcher, #character-life-open-skill-storage')) return 'skills';
    if (target.closest('#character-life-continuity-launcher, #character-life-open-continuity')) return 'continuity';
    return '';
}

function closeIntent(target) {
    if (!target) return '';
    if (target.closest('#character-life-overlay [data-action="close"], #character-life-overlay .cl-manager-backdrop')) return 'library';
    if (target.closest('#character-life-skills-overlay [data-cl-skill-close], #character-life-skills-overlay .cl-skills-backdrop')) return 'skills';
    if (target.closest('#character-life-continuity-overlay [data-cl190-close], #character-life-continuity-overlay .cl190-backdrop')) return 'continuity';
    return '';
}

function defensiveClose(event) {
    const name = closeIntent(targetElement(event));
    if (!name) return;
    closeSurface(name);
    queueMicrotask(syncBodyLock);
}

function afterUiAction() {
    removeLegacyEmbeddedSkills();
    polishSurfaceLabels();
    syncBodyLock();
}

function handleCaptureClick(event) {
    const target = targetElement(event);
    if (!target) return;

    // If an old cached/injected Skills tab survives, route it to the standalone
    // Skill Storage surface instead of allowing it to stack behind NPC Library.
    const legacySkills = target.closest('#character-life-overlay [data-cl-open-skills]');
    if (legacySkills) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeSurface('library');
        closeSurface('continuity');
        queueMicrotask(() => {
            try { globalThis.CharacterLifeSkills?.open?.(); }
            catch (error) { console.warn("[Character Life's] Legacy Skill Storage handoff failed safely.", error); }
            afterUiAction();
        });
        return;
    }

    const intent = launcherIntent(target);
    if (intent) {
        // Run before each launcher's own click handler. The requested surface is
        // opened normally by its owning feature after this capture handler.
        closeOthers(intent);
        queueMicrotask(afterUiAction);
    } else {
        // Legacy feature layers may re-inject controls after ordinary clicks.
        // Queue our cleanup after them so the standalone architecture stays stable.
        queueMicrotask(afterUiAction);
    }

    if (target.closest('#character-life-continuity-overlay [data-cl190-tab]')) {
        queueMicrotask(() => {
            const active = document.querySelector('#character-life-continuity-overlay .cl190-tabs [data-cl190-tab].is-active');
            active?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    }
}

function handleEscape(event) {
    if (event.key !== 'Escape') return;
    if (isOpen('continuity')) closeSurface('continuity');
    else if (isOpen('skills')) closeSurface('skills');
    else if (isOpen('library')) closeSurface('library');
    syncBodyLock();
}

function bind() {
    // pointerup is intentionally separate from click. On iOS this gives the X
    // buttons a reliable escape path even if a legacy click handler is confused.
    document.addEventListener('pointerup', defensiveClose, true);
    document.addEventListener('click', defensiveClose, true);
    document.addEventListener('click', handleCaptureClick, true);
    document.addEventListener('keydown', handleEscape, true);

    afterUiAction();
    for (const delay of [100, 400, 1000]) setTimeout(afterUiAction, delay);

    globalThis.CharacterLifeUiShell = Object.freeze({
        version: CL_UI_VERSION,
        close: closeSurface,
        closeOthers,
        sync: afterUiAction,
    });

    console.info(`[Character Life's] cohesive UI safety layer v${CL_UI_VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
else bind();
