/* global SillyTavern */

// Character Life v1.9.14 — touch interaction ownership for the unified shell.
// This layer loads before feature-shell-v1913 so touch/pen gestures are resolved
// exactly once before later capture listeners can observe the synthetic click.
// Mouse/keyboard behavior remains owned by the existing feature engines/shell.

const VERSION = '1.9.14';
const MOVE_TOLERANCE = 10;
const CLICK_SUPPRESS_MS = 800;

let gesture = null;
let syntheticClickDepth = 0;
let suppressedTarget = null;
let suppressedUntil = 0;

function elementFromEvent(event) {
    return event?.target instanceof Element ? event.target : null;
}

function interactiveTarget(element) {
    if (!element) return null;
    return element.closest(
        '[data-cl-product], '
        + '#character-life-continuity-overlay [data-cl190-tab], '
        + '#character-life-continuity-overlay details > summary',
    );
}

function isTouchLike(event) {
    return event?.pointerType === 'touch' || event?.pointerType === 'pen';
}

function sameInteractiveTarget(a, b) {
    return Boolean(a && b && a === b);
}

function suppressNextClick(target) {
    suppressedTarget = target;
    suppressedUntil = performance.now() + CLICK_SUPPRESS_MS;
}

function shouldSuppressClick(element) {
    if (!suppressedTarget || performance.now() > suppressedUntil) {
        suppressedTarget = null;
        suppressedUntil = 0;
        return false;
    }
    const interactive = interactiveTarget(element);
    return Boolean(interactive && interactive === suppressedTarget);
}

function dispatchOwnedClick(target) {
    syntheticClickDepth += 1;
    try {
        target.click();
    } finally {
        syntheticClickDepth -= 1;
    }
}

function toggleOwnedDetails(summary) {
    const details = summary?.parentElement;
    if (!(details instanceof HTMLDetailsElement)) return false;
    details.open = !details.open;
    summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    return true;
}

function onPointerDown(event) {
    if (!isTouchLike(event) || event.isPrimary === false) return;
    const target = interactiveTarget(elementFromEvent(event));
    if (!target) return;
    gesture = {
        pointerId: event.pointerId,
        target,
        x: event.clientX,
        y: event.clientY,
    };
}

function onPointerUp(event) {
    if (!gesture || !isTouchLike(event) || event.pointerId !== gesture.pointerId) return;

    const current = interactiveTarget(elementFromEvent(event));
    const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    const target = gesture.target;
    gesture = null;

    // A horizontal tab swipe or vertical content scroll must remain a gesture,
    // not turn into an accidental navigation action at pointer release.
    if (distance > MOVE_TOLERANCE || !sameInteractiveTarget(target, current)) return;

    const isProduct = target.matches('[data-cl-product]');
    const isContinuityTab = target.matches('#character-life-continuity-overlay [data-cl190-tab]');
    const isDetailsSummary = target.matches('#character-life-continuity-overlay details > summary');
    if (!isProduct && !isContinuityTab && !isDetailsSummary) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    suppressNextClick(target);

    if (isDetailsSummary) {
        toggleOwnedDetails(target);
        return;
    }

    // Reuse the established click contracts. For product navigation the unified
    // shell receives this click; for Continuity tabs the Continuity engine does.
    // The browser-generated follow-up click is suppressed below, so one physical
    // tap produces one state transition.
    dispatchOwnedClick(target);
}

function onPointerCancel(event) {
    if (gesture && event.pointerId === gesture.pointerId) gesture = null;
}

function onClickCapture(event) {
    // Programmatic click dispatched by onPointerUp must pass through to the
    // existing shell/engine. Only the later browser-generated click is blocked.
    if (syntheticClickDepth > 0) return;
    const target = elementFromEvent(event);
    if (!shouldSuppressClick(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressedTarget = null;
    suppressedUntil = 0;
}

function syncExistingDetails(root = document) {
    root.querySelectorAll?.('#character-life-continuity-overlay details > summary').forEach(summary => {
        const details = summary.parentElement;
        if (!(details instanceof HTMLDetailsElement)) return;
        summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    });
}

function init() {
    // Capture registration order matters: bootstrap imports this module before the
    // unified feature shell, so duplicate touch clicks are removed before the
    // shell's capture click handler can schedule any secondary UI work.
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('click', onClickCapture, true);

    syncExistingDetails();
    const observer = new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length)) syncExistingDetails();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    document.documentElement.dataset.characterLifeTouch = VERSION;
    globalThis.CharacterLifeTouchUi = Object.freeze({
        version: VERSION,
        sync: syncExistingDetails,
    });
    console.info(`[Character Life's] single-tap interaction layer v${VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
