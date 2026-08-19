/* global SillyTavern */

// Character Life v1.9.16 — destructive playthrough reset with library preservation.
// Resetting removes active story/Continuity state for the current character/group,
// while preserving Global NPCs, Character NPC identities/profiles, portraits/forms,
// themes, and non-playthrough libraries. Old chat-local state is fenced off by a
// playthrough generation id so opening an older chat cannot silently revive it.

const CL1916_VERSION = '1.9.16';
const SETTINGS_KEY = 'character_life';
const NPC_CHAT_KEY = 'character_life_npcs';
const CONTINUITY_CHAT_KEY = 'character_life_continuity_v190';
const SKILL_CHAT_KEY = 'character_life_skills';
const PLAYTHROUGH_CHAT_KEY = 'character_life_playthrough_v1916';
const PLAYTHROUGH_ARCHIVE_KEY = 'character_life_playthrough_archives_v1916';
const CONTINUITY_MEMORY_PROMPT_KEY = 'character_life_continuity_memory_v198';
const MAX_CHAT_ARCHIVES = 3;
const STORY_PROFILE_FIELDS = Object.freeze(['relationship', 'currentState']);

let uiTimer = null;
let resetInProgress = false;

const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const text = (value, fallback = '', max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const now = () => new Date().toISOString();

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

function rootSettings(create = true) {
    const context = ctx();
    if (!context?.extensionSettings) return null;
    if (create) context.extensionSettings[SETTINGS_KEY] ||= { config: {}, customDesigns: [], globalNpcs: [], characterNpcs: {} };
    const root = context.extensionSettings[SETTINGS_KEY];
    if (!root || typeof root !== 'object') return null;
    root.config ||= {};
    root.globalNpcs = Array.isArray(root.globalNpcs) ? root.globalNpcs : [];
    root.characterNpcs = root.characterNpcs && typeof root.characterNpcs === 'object' ? root.characterNpcs : {};
    root.continuity ||= {};
    root.continuity.config ||= {};
    root.continuity.worlds = root.continuity.worlds && typeof root.continuity.worlds === 'object' ? root.continuity.worlds : {};
    return root;
}

function playthroughState(create = true) {
    const root = rootSettings(create);
    if (!root) return null;
    if (create && (!root.continuity.playthrough || typeof root.continuity.playthrough !== 'object')) {
        root.continuity.playthrough = { activeId: 'legacy', resetAt: '', resetCount: 0 };
    }
    const state = root.continuity.playthrough;
    if (!state || typeof state !== 'object') return null;
    state.activeId = text(state.activeId, 'legacy', 180) || 'legacy';
    state.resetAt = text(state.resetAt, '', 80);
    state.resetCount = Math.max(0, Number(state.resetCount) || 0);
    return state;
}

function activePlaythroughId() {
    return playthroughState(true)?.activeId || 'legacy';
}

async function saveSettingsNow() {
    const saver = ctx()?.saveSettingsDebounced;
    if (typeof saver !== 'function') return;
    const queued = saver();
    if (typeof saver.flush === 'function') {
        const flushed = saver.flush();
        if (flushed?.then) await flushed;
    } else if (queued?.then) await queued;
}

function currentChatMarker(context = ctx()) {
    const marker = context?.chatMetadata?.[PLAYTHROUGH_CHAT_KEY];
    return text(marker?.id, 'legacy', 180) || 'legacy';
}

function markCurrentChat(id, context = ctx()) {
    if (!context) return;
    context.chatMetadata ||= {};
    context.chatMetadata[PLAYTHROUGH_CHAT_KEY] = {
        version: 1,
        id: text(id, 'legacy', 180) || 'legacy',
        attachedAt: now(),
    };
}

function archiveChatState(context, sourceId) {
    if (!context?.chatMetadata) return false;
    const metadata = context.chatMetadata;
    const continuity = metadata[CONTINUITY_CHAT_KEY];
    const npcs = metadata[NPC_CHAT_KEY];
    const skills = metadata[SKILL_CHAT_KEY];
    if (!continuity && !npcs && !skills) return false;

    const archives = metadata[PLAYTHROUGH_ARCHIVE_KEY] && typeof metadata[PLAYTHROUGH_ARCHIVE_KEY] === 'object'
        ? metadata[PLAYTHROUGH_ARCHIVE_KEY] : {};
    const key = text(sourceId, 'legacy', 180) || 'legacy';
    archives[key] = {
        archivedAt: now(),
        continuity: continuity ? clone(continuity) : null,
        npcs: npcs ? clone(npcs) : null,
        skills: skills ? clone(skills) : null,
    };

    const entries = Object.entries(archives).sort((a, b) => Date.parse(b[1]?.archivedAt || '') - Date.parse(a[1]?.archivedAt || ''));
    metadata[PLAYTHROUGH_ARCHIVE_KEY] = Object.fromEntries(entries.slice(0, MAX_CHAT_ARCHIVES));
    return true;
}

function clearActiveChatState(context = ctx()) {
    if (!context?.chatMetadata) return false;
    let changed = false;
    for (const key of [CONTINUITY_CHAT_KEY, NPC_CHAT_KEY, SKILL_CHAT_KEY]) {
        if (Object.prototype.hasOwnProperty.call(context.chatMetadata, key)) {
            delete context.chatMetadata[key];
            changed = true;
        }
    }
    return changed;
}

async function guardCurrentChat() {
    if (resetInProgress) return;
    const context = ctx();
    if (!context?.getCurrentChatId?.()) return;
    const activeId = activePlaythroughId();
    if (activeId === 'legacy') return;
    const marker = currentChatMarker(context);
    if (marker === activeId) return;

    archiveChatState(context, marker);
    clearActiveChatState(context);
    markCurrentChat(activeId, context);
    await context.saveMetadata?.();
    try { globalThis.CharacterLifeNpcDirector?.refreshPrompt?.(); } catch {}
    try { globalThis.CharacterLifeContinuity?.refresh?.(); } catch {}
    globalThis.dispatchEvent(new CustomEvent('character-life:continuity-updated', { detail: { reason: 'playthrough-guard', activeId } }));
    notify('info', 'This chat belonged to an older Character Life playthrough. Its old local state was archived and isolated from the active story.');
}

function clearCharacterStoryFields(root, key) {
    const list = Array.isArray(root?.characterNpcs?.[key]) ? root.characterNpcs[key] : [];
    let changed = 0;
    for (const npc of list) {
        if (!npc || typeof npc !== 'object') continue;
        let npcChanged = false;
        for (const field of STORY_PROFILE_FIELDS) {
            if (text(npc[field], '', 4000)) {
                npc[field] = '';
                npcChanged = true;
            }
        }
        if (npcChanged) {
            npc.updatedAt = now();
            changed += 1;
        }
    }
    return changed;
}

function resetCounts(root, key, context) {
    const world = root?.continuity?.worlds?.[key];
    return {
        npcStates: world?.npcs && typeof world.npcs === 'object' ? Object.keys(world.npcs).length : 0,
        relationships: world?.relationships && typeof world.relationships === 'object' ? Object.keys(world.relationships).length : 0,
        chronicle: Array.isArray(world?.chronicle) ? world.chronicle.length : 0,
        skills: world?.skillDetails && typeof world.skillDetails === 'object' ? Object.keys(world.skillDetails).length : 0,
        chatNpcs: Array.isArray(context?.chatMetadata?.[NPC_CHAT_KEY]?.npcs) ? context.chatMetadata[NPC_CHAT_KEY].npcs.length : 0,
        chatSkills: Array.isArray(context?.chatMetadata?.[SKILL_CHAT_KEY]?.skills) ? context.chatMetadata[SKILL_CHAT_KEY].skills.length : 0,
    };
}

async function resetPlaythrough() {
    if (resetInProgress) return false;
    const context = ctx();
    const root = rootSettings(true);
    if (!context || !root) {
        notify('error', 'Character Life settings are unavailable.');
        return false;
    }

    const key = characterKey(context);
    if (!key || key === 'character:unknown') {
        notify('warning', 'Open a character or group chat before resetting the playthrough.');
        return false;
    }

    const confirmed = globalThis.confirm?.(
        'RESET PLAYTHROUGH / START NEW STORY\n\n' +
        'This permanently clears the active story history for this character/group:\n' +
        '• Continuity NPC state and knowledge\n' +
        '• Relationships and relationship history\n' +
        '• Chronicle events\n' +
        '• Current scene, location, time and presence\n' +
        '• Continuity skill progression\n' +
        '• NPC persistence/significance tracking\n' +
        '• Chat-scope NPCs and Chat-scope skills\n' +
        '• Character-scope relationship/current-state fields\n\n' +
        'Global NPCs and Character NPC identities, portraits, forms, aliases, appearance, personality, background, abilities, themes and colors are preserved.\n\n' +
        'Continue?'
    );
    if (!confirmed) return false;

    resetInProgress = true;
    try {
        const counts = resetCounts(root, key, context);
        const previousId = activePlaythroughId();
        const nextId = uid('playthrough');

        if (context.getCurrentChatId?.()) archiveChatState(context, previousId);
        delete root.continuity.worlds[key];
        const profileCount = clearCharacterStoryFields(root, key);

        const playthrough = playthroughState(true);
        playthrough.activeId = nextId;
        playthrough.resetAt = now();
        playthrough.resetCount = (Number(playthrough.resetCount) || 0) + 1;
        playthrough.characterKey = key;

        clearActiveChatState(context);
        markCurrentChat(nextId, context);

        if (typeof context.setExtensionPrompt === 'function') {
            context.setExtensionPrompt(CONTINUITY_MEMORY_PROMPT_KEY, '', 1, 1, false, 0);
        }

        await context.saveMetadata?.();
        await saveSettingsNow();

        globalThis.dispatchEvent(new CustomEvent('character-life:playthrough-reset', {
            detail: { previousId, activeId: nextId, characterKey: key, counts, profileCount },
        }));
        globalThis.dispatchEvent(new CustomEvent('character-life:continuity-updated', {
            detail: { reason: 'playthrough-reset', activeId: nextId },
        }));
        try { globalThis.CharacterLifeNpcDirector?.refreshPrompt?.(); } catch {}
        try { globalThis.CharacterLifeNpcDirector?.refreshColors?.(); } catch {}
        try { globalThis.CharacterLifeContinuity?.refresh?.(); } catch {}
        scheduleUi(0);

        notify('success', 'Playthrough reset complete. Character and Global NPC libraries were preserved; the active story now starts fresh.');
        return true;
    } catch (error) {
        console.error("[Character Life's] Playthrough reset failed safely.", error);
        notify('error', 'Playthrough reset could not be completed safely.');
        return false;
    } finally {
        resetInProgress = false;
    }
}

function resetButtonHtml() {
    return `<button type="button" class="menu_button" data-cl1916-reset-playthrough><i class="fa-solid fa-arrow-rotate-left"></i><span>Reset Playthrough / Start New Story</span></button>`;
}

function resetCardHtml() {
    return `<section class="cl190-card" data-cl1916-reset-card><h4>Start a completely new story</h4><p>Erase active Continuity history, relationships, scene state, progression, and Chat-scope data while preserving the Global and Character NPC libraries.</p><div class="cl190-actions">${resetButtonHtml()}</div></section>`;
}

function patchUi() {
    uiTimer = null;
    const settings = document.getElementById('character-life-continuity-settings');
    if (settings && !settings.querySelector('[data-cl1916-reset-settings]')) {
        const wrapper = document.createElement('div');
        wrapper.dataset.cl1916ResetSettings = 'true';
        wrapper.innerHTML = `<hr><small>PLAYTHROUGH</small><p>Start over without deleting your Global or Character NPC library.</p>${resetButtonHtml()}`;
        settings.appendChild(wrapper);
    }

    const overlay = document.getElementById('character-life-continuity-overlay');
    const body = overlay?.querySelector('.cl190-body');
    const overviewActive = overlay?.querySelector('[data-cl190-tab="overview"].is-active');
    if (body && overviewActive && !body.querySelector('[data-cl1916-reset-card]')) body.insertAdjacentHTML('beforeend', resetCardHtml());
}

function scheduleUi(delay = 0) {
    clearTimeout(uiTimer);
    uiTimer = setTimeout(patchUi, delay);
}

function bindDom() {
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-cl1916-reset-playthrough]')) {
            event.preventDefault();
            void resetPlaythrough();
            return;
        }
        if (target?.closest('#character-life-open-continuity, #character-life-continuity-launcher, #character-life-continuity-overlay')) scheduleUi(0);
    }, true);
}

function bindEvents() {
    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return false;

    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED']) {
        const type = types[key];
        if (!type) continue;
        source.on(type, () => {
            void guardCurrentChat().catch(error => console.warn("[Character Life's] playthrough guard failed safely.", error));
            scheduleUi(80);
        });
    }
    for (const key of ['MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED']) {
        const type = types[key];
        if (type) source.on(type, () => scheduleUi(80));
    }
    return true;
}

playthroughState(true);
bindDom();
bindEvents();
for (const delay of [0, 120, 500, 1200]) setTimeout(patchUi, delay);
setTimeout(() => void guardCurrentChat().catch(error => console.warn("[Character Life's] initial playthrough guard failed safely.", error)), 160);

globalThis.CharacterLifePlaythrough = Object.freeze({
    version: CL1916_VERSION,
    activeId: () => activePlaythroughId(),
    reset: () => resetPlaythrough(),
    refresh: () => scheduleUi(0),
});

document.documentElement.dataset.characterLifePlaythrough = CL1916_VERSION;
console.info("[Character Life's] v1.9.16 playthrough reset + generation guard enabled.");
