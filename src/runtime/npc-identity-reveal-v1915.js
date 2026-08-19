/* global SillyTavern */

// Character Life v1.9.15 — placeholder/role label -> revealed real name repair.
// No extra generation is performed. A small extension prompt asks the main reply
// to emit CL_NPC_RENAME only when identity is certain; this layer then renames
// the original record, merges any auto-created duplicate, and migrates continuity.

const SETTINGS_KEY = 'character_life';
const NPC_CHAT_KEY = 'character_life_npcs';
const CONTINUITY_CHAT_KEY = 'character_life_continuity_v190';
const RENAME_PROMPT_KEY = 'character_life_identity_reveal_v1915';
const RENAME_PATTERN = /\[CL_NPC_RENAME\|([^|\]]+)\|([^\]]+)\]/gi;
let promptTimer = null;
let saveQueue = Promise.resolve();
const messageTimers = new Map();

const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const text = (value, fallback = '', max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const keyOf = value => text(value, '', 160).toLocaleLowerCase();
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
    return root;
}

function chatNpcState() {
    const context = ctx();
    if (!context?.getCurrentChatId?.()) return null;
    const state = context.chatMetadata?.[NPC_CHAT_KEY];
    if (!state || typeof state !== 'object') return null;
    state.version = 1;
    state.npcs = Array.isArray(state.npcs) ? state.npcs : [];
    return state;
}

function aliases(npc) {
    const raw = Array.isArray(npc?.aliases) ? npc.aliases : String(npc?.aliases || '').split(',');
    return raw.map(value => text(value, '', 120)).filter(Boolean);
}

function identityKeys(npc) {
    return new Set([text(npc?.name, '', 120), ...aliases(npc)].map(keyOf).filter(Boolean));
}

function libraries() {
    const root = rootSettings();
    if (!root) return [];
    const key = characterKey();
    root.characterNpcs[key] = Array.isArray(root.characterNpcs[key]) ? root.characterNpcs[key] : [];
    return [
        { scope: 'chat', list: chatNpcState()?.npcs || [] },
        { scope: 'character', list: root.characterNpcs[key] },
        { scope: 'global', list: root.globalNpcs },
    ];
}

function findIdentity(name) {
    const wanted = keyOf(name);
    if (!wanted) return null;
    for (const library of libraries()) {
        const index = library.list.findIndex(npc => identityKeys(npc).has(wanted));
        if (index >= 0) return { ...library, index, npc: library.list[index] };
    }
    return null;
}

const TEXT_FIELDS = [
    'role', 'affiliation', 'pronouns', 'gender', 'age', 'species', 'appearance', 'personality', 'relationship',
    'background', 'goals', 'abilities', 'speechStyle', 'currentState', 'adultAppearance', 'notes',
];

function mergeForms(targetForms, sourceForms) {
    const result = [], seen = new Set();
    for (const form of [...(Array.isArray(targetForms) ? targetForms : []), ...(Array.isArray(sourceForms) ? sourceForms : [])]) {
        if (!form || typeof form !== 'object') continue;
        const signature = text(form.id, '', 160) || `${text(form.name, '', 100)}|${text(form.portraitId, '', 180)}`;
        if (!signature || seen.has(signature)) continue;
        seen.add(signature);
        result.push(clone(form));
        if (result.length >= 50) break;
    }
    return result;
}

function mergeDuplicateInto(target, source) {
    const targetTime = Date.parse(target?.updatedAt || '') || 0;
    const sourceTime = Date.parse(source?.updatedAt || '') || 0;
    const sourceNewer = sourceTime >= targetTime;

    target.aliases = [...new Set([...aliases(target), ...aliases(source)])].slice(0, 30);
    for (const field of TEXT_FIELDS) {
        const current = text(target?.[field], '', 4000);
        const incoming = text(source?.[field], '', 4000);
        if (incoming && (!current || sourceNewer)) target[field] = incoming;
    }
    target.adultProfile = Boolean(target.adultProfile || source.adultProfile);
    target.forms = mergeForms(target.forms, source.forms);
    const active = [source.activeFormId, target.activeFormId]
        .map(value => text(value, '', 160))
        .find(id => id && target.forms.some(form => form?.id === id));
    target.activeFormId = active || target.forms[0]?.id || '';

    const targetCustom = target.themeMode === 'custom';
    const sourceCustom = source.themeMode === 'custom';
    if (sourceCustom && (!targetCustom || sourceNewer)) {
        target.themeMode = 'custom';
        target.customPalette = clone(source.customPalette || {});
        if (source.accent) target.accent = source.accent;
    } else if (!targetCustom && sourceNewer && source.autoPalette && !target.autoPalette) {
        target.themeMode = 'auto';
        target.autoPalette = clone(source.autoPalette);
        if (source.accent) target.accent = source.accent;
    }
    target.createdAt ||= source.createdAt || now();
    target.updatedAt = now();
}

function replaceNames(values, oldKeys, newName) {
    if (!Array.isArray(values)) return values;
    return [...new Set(values.map(value => oldKeys.has(keyOf(value)) ? newName : value).filter(Boolean))];
}

function migrateContinuity(oldNames, newName) {
    const root = rootSettings(false);
    if (!root) return { settings: false, metadata: false };
    const oldKeys = new Set(oldNames.map(keyOf).filter(Boolean));
    const newKey = keyOf(newName);
    if (!newKey || !oldKeys.size) return { settings: false, metadata: false };

    let settingsChanged = false;
    let metadataChanged = false;
    const world = root.continuity?.worlds?.[characterKey()];
    if (world && typeof world === 'object') {
        world.npcs = world.npcs && typeof world.npcs === 'object' ? world.npcs : {};
        for (const oldKey of oldKeys) {
            if (!oldKey || oldKey === newKey || !world.npcs[oldKey]) continue;
            const source = world.npcs[oldKey];
            if (world.npcs[newKey]) {
                const target = world.npcs[newKey];
                target.knowledge = [...(target.knowledge || []), ...(source.knowledge || [])]
                    .filter((item, index, array) => index === array.findIndex(other => JSON.stringify(other) === JSON.stringify(item)))
                    .slice(-300);
                for (const field of ['personalityEvolution', 'persistentState', 'location', 'status']) {
                    if (!text(target[field]) && text(source[field])) target[field] = source[field];
                }
                target.name = newName;
                target.updatedAt = now();
            } else {
                world.npcs[newKey] = { ...source, name: newName, updatedAt: now() };
            }
            delete world.npcs[oldKey];
            settingsChanged = true;
        }

        if (world.npcPersistence && typeof world.npcPersistence === 'object') {
            for (const oldKey of oldKeys) {
                if (!oldKey || oldKey === newKey || !world.npcPersistence[oldKey]) continue;
                const source = world.npcPersistence[oldKey];
                if (world.npcPersistence[newKey]) {
                    const target = world.npcPersistence[newKey];
                    target.score = Math.max(Number(target.score) || 0, Number(source.score) || 0);
                    target.seenChats = [...new Set([...(target.seenChats || []), ...(source.seenChats || [])])].slice(-8);
                    target.reasons = [...new Set([...(target.reasons || []), ...(source.reasons || [])])].slice(-8);
                    target.name = newName;
                    target.updatedAt = now();
                } else world.npcPersistence[newKey] = { ...source, name: newName, updatedAt: now() };
                delete world.npcPersistence[oldKey];
                settingsChanged = true;
            }
        }

        if (world.relationships && typeof world.relationships === 'object') {
            const rebuilt = {};
            for (const relationship of Object.values(world.relationships)) {
                if (!relationship || typeof relationship !== 'object') continue;
                if (oldKeys.has(keyOf(relationship.a))) { relationship.a = newName; settingsChanged = true; }
                if (oldKeys.has(keyOf(relationship.b))) { relationship.b = newName; settingsChanged = true; }
                const pair = [keyOf(relationship.a), keyOf(relationship.b)].sort().join('::');
                if (pair && pair !== '::') rebuilt[pair] = relationship;
            }
            world.relationships = rebuilt;
        }

        for (const event of Array.isArray(world.chronicle) ? world.chronicle : []) {
            if (!Array.isArray(event?.people)) continue;
            const next = replaceNames(event.people, oldKeys, newName);
            if (JSON.stringify(next) !== JSON.stringify(event.people)) { event.people = next; settingsChanged = true; }
        }
        for (const skill of Object.values(world.skillDetails || {})) {
            if (skill && oldKeys.has(keyOf(skill.owner))) { skill.owner = newName; settingsChanged = true; }
        }
        if (world.lastScene) {
            for (const field of ['present', 'absent']) {
                const next = replaceNames(world.lastScene[field], oldKeys, newName);
                if (JSON.stringify(next) !== JSON.stringify(world.lastScene[field])) { world.lastScene[field] = next; settingsChanged = true; }
            }
        }
        if (settingsChanged) world.updatedAt = now();
    }

    const chatState = ctx()?.chatMetadata?.[CONTINUITY_CHAT_KEY];
    if (chatState?.scene) {
        for (const field of ['present', 'absent']) {
            const next = replaceNames(chatState.scene[field], oldKeys, newName);
            if (JSON.stringify(next) !== JSON.stringify(chatState.scene[field])) { chatState.scene[field] = next; metadataChanged = true; }
        }
    }
    return { settings: settingsChanged, metadata: metadataChanged };
}

async function saveChanges(scopes, continuity) {
    const context = ctx();
    if (!context) return;
    if (scopes.has('chat') || continuity.metadata) await context.saveMetadata?.();
    if (scopes.has('character') || scopes.has('global') || continuity.settings) {
        const saver = context.saveSettingsDebounced;
        if (typeof saver === 'function') {
            const queued = saver();
            if (typeof saver.flush === 'function') {
                const flushed = saver.flush();
                if (flushed?.then) await flushed;
            } else if (queued?.then) await queued;
        }
    }
}

async function renameNpc(oldLabel, newLabel) {
    const oldName = text(oldLabel, '', 120);
    const newName = text(newLabel, '', 120);
    if (!oldName || !newName || keyOf(oldName) === keyOf(newName)) return false;

    const canonical = findIdentity(oldName);
    if (!canonical?.npc) return false;
    const oldNames = new Set([oldName, canonical.npc.name, ...aliases(canonical.npc)].map(value => text(value, '', 120)).filter(Boolean));
    const scopes = new Set([canonical.scope]);

    // If the core already auto-discovered the revealed name during this same
    // reply, merge that sparse duplicate back into the original slot.
    for (const library of libraries()) {
        for (let index = library.list.length - 1; index >= 0; index -= 1) {
            const npc = library.list[index];
            if (npc === canonical.npc || !identityKeys(npc).has(keyOf(newName))) continue;
            mergeDuplicateInto(canonical.npc, npc);
            library.list.splice(index, 1);
            scopes.add(library.scope);
        }
    }

    const previousName = text(canonical.npc.name, oldName, 120);
    canonical.npc.name = newName;
    canonical.npc.aliases = [...new Set([...aliases(canonical.npc), ...oldNames, previousName]
        .map(value => text(value, '', 120))
        .filter(value => value && keyOf(value) !== keyOf(newName)))].slice(0, 30);
    canonical.npc.updatedAt = now();

    const continuity = migrateContinuity([...oldNames, previousName], newName);
    await saveChanges(scopes, continuity);
    try { globalThis.CharacterLifeNpcDirector?.refreshPrompt?.(); } catch {}
    try { globalThis.CharacterLifeNpcDirector?.refreshColors?.(); } catch {}
    globalThis.dispatchEvent(new CustomEvent('character-life:continuity-updated', { detail: { reason: 'npc-identity-reveal', oldName, newName } }));
    schedulePrompt(40);
    notify('success', `${previousName} is now ${newName}; the existing NPC record was kept.`);
    return true;
}

function extractTags(raw) {
    const source = typeof raw === 'string' ? raw : '';
    if (!source.includes('[CL_NPC_RENAME|')) return [];
    RENAME_PATTERN.lastIndex = 0;
    const records = [];
    let match;
    while ((match = RENAME_PATTERN.exec(source))) {
        const oldName = text(match[1], '', 120);
        const newName = text(match[2], '', 120);
        if (oldName && newName) records.push({ oldName, newName });
    }
    return records.slice(0, 12);
}

function stripTags(raw) {
    const source = typeof raw === 'string' ? raw : '';
    if (!source.includes('[CL_NPC_RENAME|')) return { text: source, changed: false };
    RENAME_PATTERN.lastIndex = 0;
    const cleaned = source.replace(RENAME_PATTERN, '').replace(/[\t ]+$/gm, '').trimEnd();
    return { text: cleaned, changed: cleaned !== source };
}

function swipeIndex(message) {
    const index = Number(message?.swipe_id);
    return Number.isInteger(index) && index >= 0 && Array.isArray(message?.swipes) && index < message.swipes.length ? index : -1;
}

async function processMessage(messageId) {
    messageTimers.delete(String(messageId));
    const context = ctx();
    const id = Number(messageId);
    const message = context?.chat?.[id];
    if (!message || message.is_user || message.is_system) return;
    const records = extractTags(message.mes);
    if (!records.length) return;

    saveQueue = saveQueue.catch(() => undefined).then(async () => {
        for (const record of records) await renameNpc(record.oldName, record.newName);
        let changed = false;

        const cleaned = stripTags(message.mes);
        if (cleaned.changed) { message.mes = cleaned.text; changed = true; }
        const activeSwipe = swipeIndex(message);
        if (activeSwipe >= 0 && typeof message.swipes[activeSwipe] === 'string') {
            const swipe = stripTags(message.swipes[activeSwipe]);
            if (swipe.changed) { message.swipes[activeSwipe] = swipe.text; changed = true; }
        }
        if (typeof message.extra?.display_text === 'string') {
            const display = stripTags(message.extra.display_text);
            if (display.changed) { message.extra.display_text = display.text; changed = true; }
        }

        if (changed) {
            await context.saveChat?.();
            if (typeof context.updateMessageBlock === 'function') context.updateMessageBlock(id, message);
            const rendered = context.eventTypes?.CHARACTER_MESSAGE_RENDERED;
            if (rendered && context.eventSource?.emit) await context.eventSource.emit(rendered, id);
        }
    });
    await saveQueue;
}

function scheduleMessage(messageId, delay = 140) {
    const id = Number(messageId);
    if (!Number.isInteger(id) || id < 0) return;
    const key = String(id);
    clearTimeout(messageTimers.get(key));
    messageTimers.set(key, setTimeout(() => void processMessage(id), delay));
}

function refreshPrompt() {
    promptTimer = null;
    const context = ctx();
    if (!context?.setExtensionPrompt) return;
    const config = rootSettings(false)?.config || {};
    if (!context.getCurrentChatId?.() || config.injectPrompt === false || config.autoDiscover === false) {
        context.setExtensionPrompt(RENAME_PROMPT_KEY, '', 1, 1, false, 0);
        return;
    }

    context.setExtensionPrompt(RENAME_PROMPT_KEY, `CHARACTER LIFE — NPC IDENTITY REVEAL\nIf an NPC already saved under a temporary role/descriptor/unknown label reveals their real name and the conversation makes it certain they are the same person, emit exactly one machine tag at the END of the reply:\n[CL_NPC_RENAME|CURRENT SAVED LABEL|REVEALED REAL NAME]\nExample: an existing saved NPC named Nurse says her name is Mira -> [CL_NPC_RENAME|Nurse|Mira].\nUse the CURRENT saved label on the left so Character Life updates that same record instead of creating a new NPC. After the reveal, speaker tags may use the revealed name. Do not emit this for nicknames, titles, disguises, uncertain identity, or two different people. Do not put the tag in a code fence.`, 1, 1, false, 0);
}

function schedulePrompt(delay = 0) {
    clearTimeout(promptTimer);
    promptTimer = setTimeout(refreshPrompt, delay);
}

function bindEvents() {
    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return false;

    for (const [key, delay] of [['MESSAGE_RECEIVED', 140], ['MESSAGE_EDITED', 90], ['MESSAGE_SWIPED', 90]]) {
        const type = types[key];
        if (type) source.on(type, id => scheduleMessage(id, delay));
    }
    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED']) {
        const type = types[key];
        if (type) source.on(type, () => schedulePrompt(100));
    }
    return true;
}

if (bindEvents()) {
    schedulePrompt(120);
    console.info("[Character Life's] v1.9.15 NPC identity-reveal merge enabled.");
} else {
    console.warn("[Character Life's] v1.9.15 NPC identity-reveal merge could not bind to SillyTavern events.");
}
