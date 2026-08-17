// Character Life v1.9.11 — two-axis portrait framing reliability.
// Keeps the existing persisted x/y/zoom schema. The improvement is purely in
// how those values are rendered and manipulated: explicit cover sizing plus
// bounded translate3d instead of object-position combined with post-layout scale.

const CL1911_PORTRAIT_VERSION = '1.9.11';
const STAGE_SELECTOR = '#character-life-overlay [data-crop-stage]';
const states = new WeakMap();
let refreshTimer = null;
let observer = null;

const clamp = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function controlsFor(stage) {
    const host = stage.closest('[data-crop-host]');
    return {
        host,
        x: host?.querySelector('[name="x"], [data-crop-x]') || null,
        y: host?.querySelector('[name="y"], [data-crop-y]') || null,
        zoom: host?.querySelector('[name="zoom"], [data-crop-zoom]') || null,
    };
}

function valuesFor(stage) {
    const controls = controlsFor(stage);
    return {
        x: clamp(controls.x?.value ?? stage.dataset.x, 50, 0, 100),
        y: clamp(controls.y?.value ?? stage.dataset.y, 18, 0, 100),
        zoom: clamp(controls.zoom?.value ?? stage.dataset.zoom, 1, 1, 3),
    };
}

function dimensions(stage, zoom) {
    const image = stage.querySelector('img');
    const viewportWidth = Math.max(1, stage.clientWidth);
    const viewportHeight = Math.max(1, stage.clientHeight);
    const naturalWidth = Math.max(1, image?.naturalWidth || image?.width || viewportWidth);
    const naturalHeight = Math.max(1, image?.naturalHeight || image?.height || viewportHeight);
    const coverScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
    const renderedWidth = naturalWidth * coverScale * zoom;
    const renderedHeight = naturalHeight * coverScale * zoom;
    return {
        image,
        viewportWidth,
        viewportHeight,
        naturalWidth,
        naturalHeight,
        coverScale,
        renderedWidth,
        renderedHeight,
        overflowX: Math.max(0, (renderedWidth - viewportWidth) / 2),
        overflowY: Math.max(0, (renderedHeight - viewportHeight) / 2),
    };
}

function normalizedPan(value, overflow) {
    return ((50 - value) / 50) * overflow;
}

function syncControl(control, value, isZoom = false) {
    if (!control) return;
    control.value = String(value);
    const output = control.parentElement?.querySelector('output');
    if (output) output.textContent = isZoom ? `${value.toFixed(2)}×` : `${Math.round(value)}%`;
}

function applyFrame(stage, x, y, zoom) {
    if (!(stage instanceof HTMLElement)) return false;
    const values = {
        x: clamp(x, clamp(stage.dataset.x, 50, 0, 100), 0, 100),
        y: clamp(y, clamp(stage.dataset.y, 18, 0, 100), 0, 100),
        zoom: clamp(zoom, clamp(stage.dataset.zoom, 1, 1, 3), 1, 3),
    };
    stage.dataset.x = String(values.x);
    stage.dataset.y = String(values.y);
    stage.dataset.zoom = String(values.zoom);
    stage.dataset.cl1911Framing = 'true';

    const metrics = dimensions(stage, values.zoom);
    const image = metrics.image;
    if (image instanceof HTMLImageElement) {
        const panX = normalizedPan(values.x, metrics.overflowX);
        const panY = normalizedPan(values.y, metrics.overflowY);
        image.style.setProperty('position', 'absolute', 'important');
        image.style.setProperty('left', '50%', 'important');
        image.style.setProperty('top', '50%', 'important');
        image.style.setProperty('right', 'auto', 'important');
        image.style.setProperty('bottom', 'auto', 'important');
        image.style.setProperty('width', `${metrics.renderedWidth}px`, 'important');
        image.style.setProperty('height', `${metrics.renderedHeight}px`, 'important');
        image.style.setProperty('max-width', 'none', 'important');
        image.style.setProperty('max-height', 'none', 'important');
        image.style.setProperty('object-fit', 'fill', 'important');
        image.style.setProperty('object-position', '50% 50%', 'important');
        image.style.setProperty('transform-origin', '50% 50%', 'important');
        image.style.setProperty('transform', `translate(-50%, -50%) translate3d(${panX}px, ${panY}px, 0)`, 'important');
        image.style.setProperty('will-change', 'transform', 'important');
    }

    const controls = controlsFor(stage);
    syncControl(controls.x, values.x, false);
    syncControl(controls.y, values.y, false);
    syncControl(controls.zoom, values.zoom, true);
    return true;
}

function beginOrigin(stage, state) {
    const points = [...state.pointers.values()];
    const values = valuesFor(stage);
    state.origin = { ...values, points };
    state.pinchDistance = points.length > 1
        ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
        : 0;
}

function assistedZoom(stage, origin, dx, dy) {
    const metrics = dimensions(stage, origin.zoom);
    let target = origin.zoom;
    const minRoomX = Math.min(28, metrics.viewportWidth * 0.08);
    const minRoomY = Math.min(28, metrics.viewportHeight * 0.08);

    if (Math.abs(dx) > 4 && metrics.overflowX < 1) {
        const required = (metrics.viewportWidth + minRoomX * 2) / (metrics.naturalWidth * metrics.coverScale);
        target = Math.max(target, required);
    }
    if (Math.abs(dy) > 4 && metrics.overflowY < 1) {
        const required = (metrics.viewportHeight + minRoomY * 2) / (metrics.naturalHeight * metrics.coverScale);
        target = Math.max(target, required);
    }
    return clamp(target, origin.zoom, 1, 3);
}

function handlePointerDown(event) {
    const stage = event.target instanceof Element ? event.target.closest(STAGE_SELECTOR) : null;
    if (!(stage instanceof HTMLElement)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    let state = states.get(stage);
    if (!state) {
        state = { pointers: new Map(), origin: null, pinchDistance: 0 };
        states.set(stage, state);
    }
    stage.setPointerCapture?.(event.pointerId);
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginOrigin(stage, state);
    stage.classList.add('is-adjusting', 'cl1911-is-adjusting');
}

function handlePointerMove(event) {
    for (const stage of document.querySelectorAll(STAGE_SELECTOR)) {
        const state = states.get(stage);
        if (!state?.pointers.has(event.pointerId) || !state.origin) continue;

        event.preventDefault();
        event.stopImmediatePropagation();
        state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...state.pointers.values()];

        if (points.length > 1 && state.pinchDistance > 0) {
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            applyFrame(stage, state.origin.x, state.origin.y, state.origin.zoom * distance / state.pinchDistance);
            return;
        }

        const start = state.origin.points[0];
        const dx = points[0].x - start.x;
        const dy = points[0].y - start.y;
        const zoom = assistedZoom(stage, state.origin, dx, dy);
        if (zoom > state.origin.zoom + 0.001) {
            applyFrame(stage, state.origin.x, state.origin.y, zoom);
            beginOrigin(stage, state);
            return;
        }

        const metrics = dimensions(stage, state.origin.zoom);
        const x = metrics.overflowX > 0.5
            ? state.origin.x - dx / (metrics.overflowX * 2) * 100
            : state.origin.x;
        const y = metrics.overflowY > 0.5
            ? state.origin.y - dy / (metrics.overflowY * 2) * 100
            : state.origin.y;
        applyFrame(stage, x, y, state.origin.zoom);
        return;
    }
}

function endPointer(event) {
    for (const stage of document.querySelectorAll(STAGE_SELECTOR)) {
        const state = states.get(stage);
        if (!state?.pointers.has(event.pointerId)) continue;
        event.preventDefault();
        event.stopImmediatePropagation();
        state.pointers.delete(event.pointerId);
        try { stage.releasePointerCapture?.(event.pointerId); } catch {}
        if (state.pointers.size) beginOrigin(stage, state);
        else {
            state.origin = null;
            state.pinchDistance = 0;
            stage.classList.remove('is-adjusting', 'cl1911-is-adjusting');
        }
        return;
    }
}

function handleWheel(event) {
    const stage = event.target instanceof Element ? event.target.closest(STAGE_SELECTOR) : null;
    if (!(stage instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = valuesFor(stage);
    applyFrame(stage, values.x, values.y, values.zoom - event.deltaY * 0.0015);
}

function handleDoubleClick(event) {
    const stage = event.target instanceof Element ? event.target.closest(STAGE_SELECTOR) : null;
    if (!(stage instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applyFrame(stage, 50, 18, 1);
}

function handleRangeInput(event) {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input || input.type !== 'range' || !input.closest('#character-life-overlay [data-form="framing"], #character-life-overlay [data-new-crop]')) return;
    const host = input.closest('[data-crop-host]');
    const stage = host?.querySelector('[data-crop-stage]');
    if (!(stage instanceof HTMLElement)) return;
    event.stopImmediatePropagation();
    const controls = controlsFor(stage);
    applyFrame(stage, controls.x?.value, controls.y?.value, controls.zoom?.value);
}

function handleResetClick(event) {
    const button = event.target instanceof Element ? event.target.closest('#character-life-overlay [data-action="reset-crop"]') : null;
    if (!(button instanceof HTMLElement)) return;
    const stage = button.closest('[data-crop-host]')?.querySelector('[data-crop-stage]');
    if (!(stage instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applyFrame(stage, 50, 18, 1);
}

function decorateStage(stage) {
    if (!(stage instanceof HTMLElement)) return;
    stage.dataset.cl1911Framing = 'true';
    stage.setAttribute('aria-label', 'Portrait framing: drag in any direction, pinch or wheel to zoom');
    const image = stage.querySelector('img');
    if (image instanceof HTMLImageElement && !image.complete) {
        image.addEventListener('load', () => applyFrame(stage, ...Object.values(valuesFor(stage))), { once: true });
    }
    const values = valuesFor(stage);
    applyFrame(stage, values.x, values.y, values.zoom);
}

function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
    try {
        document.querySelectorAll(STAGE_SELECTOR).forEach(decorateStage);
    } catch (error) {
        console.warn("[Character Life's] v1.9.11 portrait framing refresh skipped safely.", error);
    }
}

function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
}

function init() {
    document.documentElement.dataset.characterLifePortraitFraming = CL1911_PORTRAIT_VERSION;
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', endPointer, true);
    document.addEventListener('pointercancel', endPointer, true);
    document.addEventListener('lostpointercapture', endPointer, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    document.addEventListener('dblclick', handleDoubleClick, true);
    document.addEventListener('input', handleRangeInput, true);
    document.addEventListener('click', handleResetClick, true);

    observer = new MutationObserver(records => {
        if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleRefresh(20);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    globalThis.addEventListener('resize', () => scheduleRefresh(40));
    globalThis.addEventListener('orientationchange', () => scheduleRefresh(80));
    for (const delay of [0, 80, 250, 700, 1500]) setTimeout(refresh, delay);

    globalThis.CharacterLifePortraitFraming = Object.freeze({
        version: CL1911_PORTRAIT_VERSION,
        refresh,
        apply: applyFrame,
    });
    console.info(`[Character Life's] portrait framing reliability v${CL1911_PORTRAIT_VERSION} loaded.`);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
