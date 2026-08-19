/* global SillyTavern */

// Character Life v1.9.15 — explicit carry-current-context choice for New Chat.
// Durable Continuity state already lives at Character/Group scope. This layer
// only offers to copy the current chat-local scene, NPCs, and skills.
import './playthrough-reset-v1916.js';

const NPC_CHAT_KEY = 'character_life_npcs';
const CONTINUITY_CHAT_KEY = 'character_life_continuity_v190';
const SKILL_CHAT_KEY = 'character_life_skills';
const MAX_NPCS = 500;
let pendingTransfer = null;

const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const text = (value, fallback = '', max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;

function notify(type, message) {
    if (globalThis.toastr && typeof globalThis.toastr[type] === 'function') globalThis.toastr[type](message, "Character Life's");
    else console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
}

function characterKey(context = ctx()) {
    if (!context) return 'character:unknown';
    const group = context.groupId ?? context.group?.id;
    if (group !== undefined && group !== null && group !== '') return `group:${group}`;
    const id = context.characterId ?? context.character?.id;
    const character = context.character || (Array.isArray(context.characters) ? context.characters[id] : null);
    return `character:${text(character?.avatar, '', 180) || id || text(context.name2 || character?.name, 'unknown', 180)}`;
}

function activePlaythroughId() {
    try { return text(globalThis.CharacterLifePlaythrough?.activeId?.(), 'legacy', 180) || 'legacy'; }
    catch { return 'legacy'; }
}

function currentSnapshot() {
    const context = ctx();
    const chatId = text(context?.getCurrentChatId?.(), '', 300);
    if (!context || !chatId) return null;

    const continuity = context.chatMetadata?.[CONTINUITY_CHAT_KEY];
    const scene = continuity?.scene && typeof continuity.scene === 'object' ? clone(continuity.scene) : null;
    const npcs = Array.isArray(context.chatMetadata?.[NPC_CHAT_KEY]?.npcs)
        ? clone(context.chatMetadata[NPC_CHAT_KEY].npcs.slice(0, MAX_NPCS)) : [];
    const skills = Array.isArray(context.chatMetadata?.[SKILL_CHAT_KEY]?.skills)
        ? clone(context.chatMetadata[SKILL_CHAT_KEY].skills) : [];

    const sceneHasData = Boolean(
        scene && [scene.title, scene.location, scene.time, scene.day, scene.activity, scene.conditions].some(value => text(value))
        || Array.isArray(scene?.present) && scene.present.length
        || Array.isArray(scene?.absent) && scene.absent.length
    );
    if (!sceneHasData && !npcs.length && !skills.length) return null;
    return { sourceChatId: chatId, characterKey: characterKey(context), playthroughId: activePlaythroughId(), scene, npcs, skills };
}

function newChatControl(target) {
    if (!(target instanceof Element)) return null;
    const known = target.closest('#option_new_chat, #option_start_new_chat, [data-action="new-chat"], [data-action="new_chat"], [data-action="newChat"]');
    if (known) return known;
    const clickable = target.closest('button, .menu_button, [role="button"], a');
    if (!clickable) return null;
    const label = `${clickable.getAttribute('aria-label') || ''} ${clickable.getAttribute('title') || ''} ${clickable.textContent || ''}`
        .replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    return /^(new chat|start new chat|new conversation)$/.test(label) ? clickable : null;
}

function captureChoice(event) {
    if (!newChatControl(event.target)) return;
    const snapshot = currentSnapshot();
    if (!snapshot) { pendingTransfer = null; return; }

    const carry = globalThis.confirm?.(
        'Carry the current Character Life context into the new chat?\n\n' +
        'This copies the current scene plus Chat-scope NPCs and skills. Durable Continuity data already carries automatically.\n\n' +
        'OK = Carry current context\nCancel = Start fresh'
    );
    pendingTransfer = carry ? snapshot : null;
}

async function applyTransfer() {
    if (!pendingTransfer) return;
    const context = ctx();
    const targetChatId = text(context?.getCurrentChatId?.(), '', 300);
    if (!context || !targetChatId || targetChatId === pendingTransfer.sourceChatId) return;

    const transfer = pendingTransfer;
    pendingTransfer = null;
    if (characterKey(context) !== transfer.characterKey) return;
    if (activePlaythroughId() !== transfer.playthroughId) return;

    context.chatMetadata ||= {};
    if (transfer.scene) {
        context.chatMetadata[CONTINUITY_CHAT_KEY] = {
            version: 1,
            scene: clone(transfer.scene),
            timelineId: uid('timeline'),
            startedAt: new Date().toISOString(),
            lastAppliedMessage: -1,
        };
    }
    if (transfer.npcs.length) context.chatMetadata[NPC_CHAT_KEY] = { version: 1, npcs: clone(transfer.npcs) };
    if (transfer.skills.length) context.chatMetadata[SKILL_CHAT_KEY] = { version: 1, skills: clone(transfer.skills) };

    await context.saveMetadata?.();
    try { globalThis.CharacterLifeNpcDirector?.refreshPrompt?.(); } catch {}
    globalThis.dispatchEvent(new CustomEvent('character-life:continuity-updated', { detail: { reason: 'new-chat-transfer' } }));
    notify('success', 'Current Character Life context carried into the new chat.');
}

function bindEvents() {
    const context = ctx();
    const type = context?.eventTypes?.CHAT_CHANGED;
    if (!context?.eventSource?.on || !type) return false;
    context.eventSource.on(type, () => {
        setTimeout(() => void applyTransfer().catch(error => console.warn("[Character Life's] New-chat context transfer failed safely.", error)), 80);
    });
    return true;
}

globalThis.addEventListener('character-life:playthrough-reset', () => { pendingTransfer = null; });
document.addEventListener('click', captureChoice, true);
if (bindEvents()) console.info("[Character Life's] v1.9.15 New Chat context choice enabled.");
else console.warn("[Character Life's] v1.9.15 New Chat context choice could not bind to SillyTavern events.");
