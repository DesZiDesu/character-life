/* global SillyTavern */

// Character Life v1.9.15 — one header per contiguous speaker run.
// The model prompt already asks for this behavior; this local repair makes the
// renderer deterministic when a model repeats CL_HEADER for the same speaker.

let repairTimer = null;
const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const keyOf = value => String(value || '').trim().toLocaleLowerCase();

function normalizeSpeakerHeaders(root) {
    if (!(root instanceof Element)) return false;
    const blocks = [...root.querySelectorAll('.cl-chat-block[data-cl-name]')];
    if (!blocks.length) return false;

    let activeSpeaker = '';
    let changed = false;
    for (const block of blocks) {
        const speaker = keyOf(block.dataset.clName);
        if (!speaker) continue;

        if (block.classList.contains('cl-chat-header')) {
            if (speaker === activeSpeaker) {
                block.remove();
                changed = true;
                continue;
            }
            activeSpeaker = speaker;
            continue;
        }

        // Narration and thoughts do not end a speaker run. A dialogue from a
        // different character does, even when the model omitted that header.
        if (block.classList.contains('cl-chat-dialogue') && speaker !== activeSpeaker) activeSpeaker = speaker;
    }

    if (changed) root.dataset.clHeaderRunsNormalized = 'true';
    return changed;
}

function repairVisibleMessages() {
    repairTimer = null;
    document.querySelectorAll('#chat .mes_text.character-life-rendered').forEach(normalizeSpeakerHeaders);
}

function scheduleRepair(delay = 0) {
    clearTimeout(repairTimer);
    repairTimer = setTimeout(() => requestAnimationFrame(repairVisibleMessages), delay);
}

function bindEvents() {
    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return false;

    for (const [key, delay] of [
        ['CHARACTER_MESSAGE_RENDERED', 0],
        ['MESSAGE_RECEIVED', 60],
        ['MESSAGE_EDITED', 40],
        ['MESSAGE_SWIPED', 40],
        ['MORE_MESSAGES_LOADED', 40],
        ['CHAT_LOADED', 70],
        ['CHAT_CHANGED', 90],
    ]) {
        const type = types[key];
        if (type) source.on(type, () => scheduleRepair(delay));
    }
    return true;
}

if (bindEvents()) {
    scheduleRepair(120);
    console.info("[Character Life's] v1.9.15 single-header speaker runs enabled.");
} else {
    console.warn("[Character Life's] v1.9.15 speaker-run repair could not bind to SillyTavern events.");
}
