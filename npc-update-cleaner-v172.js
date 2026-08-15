/* global SillyTavern */

// Character Life v1.7.2 raw NPC-update cleaner.
// The core renderer consumes CL_NPC_UPDATE tags first; this module then removes
// only those machine-control tags from the stored SillyTavern message so edits
// stay clean and removed tags cannot leave trailing rendered whitespace.

const UPDATE_OPEN = '[CL_NPC_UPDATE|';
const UPDATE_PATTERN = /\[CL_NPC_UPDATE\|([^|\]]+)\|([^\]]+)\]([\s\S]*?)\[\/CL_NPC_UPDATE\]/gi;
const CLEAN_DELAY = 120;
const BULK_CLEAN_DELAY = 260;
let initialized = false;
let bulkTimer = null;
const messageTimers = new Map();

function context() {
    return globalThis.SillyTavern?.getContext?.() || null;
}

function hasUpdateTags(value) {
    return typeof value === 'string' && value.includes(UPDATE_OPEN);
}

function stripUpdateTags(value) {
    const source = typeof value === 'string' ? value : '';
    if (!hasUpdateTags(source)) return { text: source, changed: false };

    UPDATE_PATTERN.lastIndex = 0;
    const text = source.replace(UPDATE_PATTERN, '').replace(/[\t ]+$/gm, '').trimEnd();
    return { text, changed: text !== source };
}

function activeSwipeIndex(message) {
    const index = Number(message?.swipe_id);
    return Number.isInteger(index) && index >= 0 && Array.isArray(message?.swipes) && index < message.swipes.length ? index : -1;
}

function cleanStoredMessage(message) {
    if (!message || message.is_user || message.is_system) return false;

    let changed = false;
    const original = typeof message.mes === 'string' ? message.mes : '';
    const cleaned = stripUpdateTags(original);
    if (cleaned.changed) {
        message.mes = cleaned.text;
        changed = true;
    }

    const swipeIndex = activeSwipeIndex(message);
    if (swipeIndex >= 0) {
        const swipe = message.swipes[swipeIndex];
        if (typeof swipe === 'string') {
            const cleanedSwipe = stripUpdateTags(swipe);
            if (cleanedSwipe.changed) {
                message.swipes[swipeIndex] = cleanedSwipe.text;
                changed = true;
            } else if (cleaned.changed && swipe === original) {
                message.swipes[swipeIndex] = cleaned.text;
                changed = true;
            }
        }
    }

    // Some display/translation extensions keep a rendered text override here.
    // Remove only Character Life's machine tag from that override as well so a
    // forced re-render cannot resurrect the hidden update block.
    if (typeof message.extra?.display_text === 'string') {
        const display = stripUpdateTags(message.extra.display_text);
        if (display.changed) {
            message.extra.display_text = display.text;
            changed = true;
        }
    }

    return changed;
}

async function rerenderCleanMessage(messageId, message) {
    const ctx = context();
    if (!ctx || !message) return;

    try {
        if (typeof ctx.updateMessageBlock === 'function') ctx.updateMessageBlock(Number(messageId), message);
        const renderedEvent = ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED;
        if (renderedEvent && ctx.eventSource?.emit) await ctx.eventSource.emit(renderedEvent, Number(messageId));
    } catch (error) {
        console.warn("[Character Life's] Could not refresh a cleaned message.", error);
    }
}

async function saveCleanedChat() {
    const ctx = context();
    if (typeof ctx?.saveChat !== 'function') return;
    try {
        await ctx.saveChat();
    } catch (error) {
        console.warn("[Character Life's] Could not persist cleaned NPC update tags immediately.", error);
    }
}

async function cleanMessageAfterCore(messageId) {
    messageTimers.delete(String(messageId));
    const ctx = context();
    const id = Number(messageId);
    const message = ctx?.chat?.[id];
    if (!message || !hasUpdateTags(message.mes) && !hasUpdateTags(message.extra?.display_text)) return false;

    if (!cleanStoredMessage(message)) return false;
    await saveCleanedChat();
    await rerenderCleanMessage(id, message);
    return true;
}

function scheduleMessageCleanup(messageId, delay = CLEAN_DELAY) {
    const id = Number(messageId);
    if (!Number.isInteger(id) || id < 0) {
        scheduleVisibleCleanup(delay);
        return;
    }
    const key = String(id);
    const existing = messageTimers.get(key);
    if (existing) clearTimeout(existing);
    messageTimers.set(key, setTimeout(() => {
        void cleanMessageAfterCore(id);
    }, delay));
}

function visibleMessageIds() {
    return [...document.querySelectorAll('#chat .mes[mesid]')]
        .map(element => Number(element.getAttribute('mesid')))
        .filter(Number.isInteger);
}

async function cleanVisibleLegacyMessages() {
    bulkTimer = null;
    const ctx = context();
    if (!ctx?.chat) return;

    const changed = [];
    for (const id of visibleMessageIds()) {
        const message = ctx.chat[id];
        if (!message || !hasUpdateTags(message.mes) && !hasUpdateTags(message.extra?.display_text)) continue;
        if (cleanStoredMessage(message)) changed.push([id, message]);
    }

    if (!changed.length) return;
    await saveCleanedChat();
    for (const [id, message] of changed) await rerenderCleanMessage(id, message);
}

function scheduleVisibleCleanup(delay = BULK_CLEAN_DELAY) {
    if (bulkTimer) clearTimeout(bulkTimer);
    bulkTimer = setTimeout(() => void cleanVisibleLegacyMessages(), delay);
}

function bindEvents() {
    const ctx = context();
    const source = ctx?.eventSource;
    const types = ctx?.eventTypes;
    if (!source || !types) return false;

    // Character Life core registers first and consumes updates from the rendered
    // message. Cleanup runs just after that first render, then re-renders from
    // the clean stored text. No profile-update logic is duplicated here.
    if (types.MESSAGE_RECEIVED) source.on(types.MESSAGE_RECEIVED, id => scheduleMessageCleanup(id, CLEAN_DELAY));
    if (types.MESSAGE_EDITED) source.on(types.MESSAGE_EDITED, id => scheduleMessageCleanup(id, CLEAN_DELAY));
    if (types.MESSAGE_SWIPED) source.on(types.MESSAGE_SWIPED, id => scheduleMessageCleanup(id, CLEAN_DELAY));
    if (types.MORE_MESSAGES_LOADED) source.on(types.MORE_MESSAGES_LOADED, () => scheduleVisibleCleanup(180));
    if (types.CHAT_CHANGED) source.on(types.CHAT_CHANGED, () => scheduleVisibleCleanup(BULK_CLEAN_DELAY));
    return true;
}

function initialize() {
    if (initialized) return;
    if (!bindEvents()) {
        console.warn("[Character Life's] Raw NPC update cleaner could not bind to SillyTavern events.");
        return;
    }
    initialized = true;
    scheduleVisibleCleanup(BULK_CLEAN_DELAY);
    console.info("[Character Life's] Raw NPC update cleanup enabled.");
}

initialize();
