/* global SillyTavern */

// Character Life v1.9.7 — canonical NPC scope + identity-color repair.
// Deterministic/local only: no extra AI generation and no document-wide
// MutationObserver. Character becomes the canonical home when Continuity is
// configured to carry NPC development across chats.

const CL197_VERSION = '1.9.7';
const SETTINGS_KEY = 'character_life';
const CHAT_KEY = 'character_life_npcs';
const MAX_NPCS = 500;

let initialized = false;
let reconcileTimer = null;
let renderTimer = null;
let reconciling = false;
let reconcileAgain = false;

const ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const clean = (value, fallback = '', max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
const hex = value => validHex(value) ? String(value).toUpperCase() : '';
const keyOf = value => clean(value, '', 160).toLocaleLowerCase();

function characterKey() {
    const c = ctx();
    if (!c) return 'character:unknown';
    const group = c.groupId ?? c.group?.id;
    if (group !== undefined && group !== null && group !== '') return `group:${group}`;
    const id = c.characterId ?? c.character?.id;
    const character = c.character || (Array.isArray(c.characters) ? c.characters[id] : null);
    return `character:${clean(character?.avatar, '', 180) || id || clean(c.name2 || character?.name, 'unknown', 180)}`;
}

function settingsRoot() {
    const c = ctx();
    if (!c?.extensionSettings) return null;
    const root = c.extensionSettings[SETTINGS_KEY] ||= { config: {}, customDesigns: [], globalNpcs: [], characterNpcs: {} };
    root.config ||= {};
    root.globalNpcs = Array.isArray(root.globalNpcs) ? root.globalNpcs : [];
    root.characterNpcs = root.characterNpcs && typeof root.characterNpcs === 'object' ? root.characterNpcs : {};
    return root;
}

function chatState(create = false) {
    const c = ctx();
    if (!c?.getCurrentChatId?.()) return null;
    c.chatMetadata ||= {};
    if (create) c.chatMetadata[CHAT_KEY] ||= { version: 1, npcs: [] };
    const state = c.chatMetadata[CHAT_KEY];
    if (!state || typeof state !== 'object') return null;
    state.version = 1;
    state.npcs = Array.isArray(state.npcs) ? state.npcs : [];
    return state;
}

function aliases(npc) {
    const list = Array.isArray(npc?.aliases) ? npc.aliases : String(npc?.aliases || '').split(',');
    return list.map(value => clean(value, '', 120)).filter(Boolean);
}

function identityKeys(npc) {
    return new Set([clean(npc?.name, '', 120), ...aliases(npc)].map(keyOf).filter(Boolean));
}

function sameNpc(a, b) {
    const left = identityKeys(a), right = identityKeys(b);
    for (const key of left) if (right.has(key)) return true;
    return false;
}

function hslToHex(hue, saturation, lightness) {
    const h = ((Number(hue) % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
    const l = Math.max(0, Math.min(100, Number(lightness))) / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - chroma / 2;
    const rgb = h < 60 ? [chroma, x, 0]
        : h < 120 ? [x, chroma, 0]
            : h < 180 ? [0, chroma, x]
                : h < 240 ? [0, x, chroma]
                    : h < 300 ? [x, 0, chroma]
                        : [chroma, 0, x];
    return `#${rgb.map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

// Match the core's namePalette() header algorithm. This keeps a portrait-less
// automatic NPC's library avatar and chat identity on the same stable color.
function nameIdentityColor(name) {
    let hash = 0;
    for (const character of String(name || 'Unknown')) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
    return hslToHex(Math.abs(hash) % 360, 68, 65);
}

function identityColor(npc) {
    const custom = npc?.customPalette && typeof npc.customPalette === 'object' ? npc.customPalette : {};
    const automatic = npc?.autoPalette && typeof npc.autoPalette === 'object' ? npc.autoPalette : {};
    if (npc?.themeMode === 'custom') return hex(custom.header) || hex(npc?.accent) || nameIdentityColor(npc?.name);
    return hex(automatic.header) || nameIdentityColor(npc?.name);
}

function unifyNpcColor(npc) {
    if (!npc || typeof npc !== 'object' || !clean(npc.name, '', 120)) return false;
    const color = identityColor(npc);
    let changed = false;
    if (hex(npc.accent) !== color) { npc.accent = color; changed = true; }

    if (npc.themeMode === 'custom') {
        const current = npc.customPalette && typeof npc.customPalette === 'object' ? npc.customPalette : {};
        if (hex(current.header) !== color || hex(current.thought) !== color || hex(current.dialogue) !== color) {
            npc.customPalette = { ...current, header: color, thought: color, dialogue: color };
            changed = true;
        }
    } else if (hex(npc.autoPalette?.header)) {
        // Preserve null autoPalette for portrait-less NPCs. Core uses null to
        // know that a future portrait still needs automatic palette extraction.
        const current = npc.autoPalette;
        if (hex(current.thought) !== color || hex(current.dialogue) !== color || hex(current.header) !== color) {
            npc.autoPalette = { ...current, header: color, thought: color, dialogue: color };
            changed = true;
        }
    }
    return changed;
}

const TEXT_FIELDS = [
    'role','affiliation','pronouns','gender','age','species','appearance','personality','relationship',
    'background','goals','abilities','speechStyle','currentState','adultAppearance','notes',
];

function mergeForms(targetForms, sourceForms) {
    const result = [], seen = new Set();
    for (const form of [...(Array.isArray(sourceForms) ? sourceForms : []), ...(Array.isArray(targetForms) ? targetForms : [])]) {
        if (!form || typeof form !== 'object') continue;
        const id = clean(form.id, '', 160);
        const signature = id || `${clean(form.name, '', 100)}|${clean(form.portraitId, '', 180)}`;
        if (!signature || seen.has(signature)) continue;
        seen.add(signature);
        result.push(clone(form));
        if (result.length >= 50) break;
    }
    return result;
}

function mergeNpc(target, source) {
    const next = clone(target || source || {});
    const targetTime = Date.parse(target?.updatedAt || '') || 0;
    const sourceTime = Date.parse(source?.updatedAt || '') || 0;
    const sourceNewer = sourceTime >= targetTime;
    next.aliases = [...new Set([...aliases(target), ...aliases(source)])].slice(0, 30);

    for (const field of TEXT_FIELDS) {
        const src = clean(source?.[field], '', 4000);
        const dst = clean(target?.[field], '', 4000);
        if (src && (!dst || sourceNewer)) next[field] = src;
    }

    next.adultProfile = Boolean(target?.adultProfile || source?.adultProfile);
    next.forms = mergeForms(target?.forms, source?.forms);
    const preferredForms = [source?.activeFormId, target?.activeFormId].map(value => clean(value, '', 160)).filter(Boolean);
    next.activeFormId = preferredForms.find(id => next.forms.some(form => form?.id === id)) || next.forms[0]?.id || '';

    const targetCustom = target?.themeMode === 'custom';
    const sourceCustom = source?.themeMode === 'custom';
    if (sourceCustom && (!targetCustom || sourceNewer)) {
        next.themeMode = 'custom';
        next.customPalette = clone(source.customPalette || {});
        next.accent = source.accent;
    } else if (targetCustom) {
        next.themeMode = 'custom';
        next.customPalette = clone(target.customPalette || {});
        next.accent = target.accent;
    } else {
        next.themeMode = 'auto';
        const paletteOwner = sourceNewer && source?.autoPalette ? source : target?.autoPalette ? target : source;
        next.autoPalette = paletteOwner?.autoPalette ? clone(paletteOwner.autoPalette) : null;
        next.accent = paletteOwner?.accent || next.accent;
    }

    next.id = clean(target?.id, '', 160) || clean(source?.id, '', 160) || next.id;
    next.name = clean(target?.name, '', 120) || clean(source?.name, 'Unknown NPC', 120);
    next.createdAt = clean(target?.createdAt, '', 80) || clean(source?.createdAt, '', 80) || new Date().toISOString();
    next.updatedAt = sourceNewer ? (clean(source?.updatedAt, '', 80) || clean(target?.updatedAt, '', 80)) : clean(target?.updatedAt, '', 80);
    next.updatedAt ||= new Date().toISOString();
    unifyNpcColor(next);
    return next;
}

function shouldCarryToCharacter(root) {
    const cfg = root?.continuity?.config;
    return cfg?.enabled !== false && cfg?.carryNpcEvolution !== false;
}

async function persistSettings() {
    const saver = ctx()?.saveSettingsDebounced;
    if (typeof saver !== 'function') return;
    const queued = saver();
    if (typeof saver.flush === 'function') {
        const flushed = saver.flush();
        if (flushed?.then) await flushed;
    } else if (queued?.then) await queued;
}

async function reconcileStorage() {
    if (reconciling) { reconcileAgain = true; return; }
    reconciling = true;
    try {
        const c = ctx(), root = settingsRoot();
        if (!c || !root) return;
        const key = characterKey();
        root.characterNpcs[key] = Array.isArray(root.characterNpcs[key]) ? root.characterNpcs[key] : [];
        const chat = chatState(false);
        let settingsChanged = false, metadataChanged = false;

        if (root.config.unifiedNpcColors !== true) { root.config.unifiedNpcColors = true; settingsChanged = true; }
        for (const npc of root.globalNpcs) if (unifyNpcColor(npc)) settingsChanged = true;
        for (const npc of root.characterNpcs[key]) if (unifyNpcColor(npc)) settingsChanged = true;
        if (chat?.npcs) for (const npc of chat.npcs) if (unifyNpcColor(npc)) metadataChanged = true;

        if (chat?.npcs?.length && shouldCarryToCharacter(root)) {
            const character = root.characterNpcs[key];
            for (const source of chat.npcs.slice(0, MAX_NPCS)) {
                if (!source || !clean(source.name, '', 120)) continue;
                const index = character.findIndex(target => sameNpc(target, source));
                if (index >= 0) character[index] = mergeNpc(character[index], source);
                else {
                    const promoted = clone(source);
                    unifyNpcColor(promoted);
                    character.push(promoted);
                }
                settingsChanged = true;
            }
            // Continuity already treats these NPC facts as cross-chat data.
            // Make that promotion a MOVE/merge instead of retaining a second
            // Chat copy that shadows the Character record.
            chat.npcs = [];
            metadataChanged = true;
        }

        const canonical = [];
        for (const npc of root.characterNpcs[key].slice(0, MAX_NPCS)) {
            const index = canonical.findIndex(existing => sameNpc(existing, npc));
            if (index < 0) canonical.push(npc);
            else { canonical[index] = mergeNpc(canonical[index], npc); settingsChanged = true; }
        }
        if (canonical.length !== root.characterNpcs[key].length) settingsChanged = true;
        root.characterNpcs[key] = canonical;

        if (metadataChanged && chat) {
            c.chatMetadata[CHAT_KEY] = chat;
            await c.saveMetadata?.();
        }
        if (settingsChanged) await persistSettings();
        try { globalThis.CharacterLifeNpcDirector?.refreshPrompt?.(); } catch {}
        schedulePresentation(0);
    } catch (error) {
        console.error("[Character Life's] v1.9.7 NPC scope/identity reconciliation failed safely.", error);
    } finally {
        reconciling = false;
        if (reconcileAgain) { reconcileAgain = false; scheduleReconcile(80); }
    }
}

function resolveNpc(name) {
    const root = settingsRoot();
    if (!root) return null;
    const wanted = keyOf(name);
    if (!wanted) return null;
    const lists = [chatState(false)?.npcs || [], root.characterNpcs[characterKey()] || [], root.globalNpcs || []];
    for (const list of lists) {
        const hit = list.find(npc => identityKeys(npc).has(wanted));
        if (hit) return hit;
    }
    return null;
}

function repairRenderedColors(rootNode = document) {
    document.documentElement.dataset.clUnifiedColors = 'true';
    const queryRoot = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
    const messages = [];
    if (rootNode instanceof Element && rootNode.matches?.('.mes_text.character-life-rendered')) messages.push(rootNode);
    for (const message of queryRoot.querySelectorAll?.('.mes_text.character-life-rendered') || []) messages.push(message);

    for (const message of [...new Set(messages)]) {
        message.dataset.clUnifiedColors = 'true';
        for (const block of message.querySelectorAll('.cl-chat-block[data-cl-name]')) {
            const npc = resolveNpc(block.dataset.clName);
            const color = npc ? identityColor(npc) : nameIdentityColor(block.dataset.clName);
            block.style.setProperty('--cl-unified-color', color, 'important');
            block.style.setProperty('--cl-local-header', color, 'important');
            block.style.setProperty('--cl-local-thought', color, 'important');
            block.style.setProperty('--cl-local-dialogue', color, 'important');
        }
    }
    try { globalThis.CharacterLifeNpcDirector?.refreshColors?.(); } catch {}
}

function setLabel(control, labelText) {
    const span = control?.closest?.('label')?.querySelector(':scope > span');
    if (span) span.textContent = labelText;
}

function patchNpcEditor(rootNode = document) {
    const queryRoot = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : document;
    const forms = [];
    if (rootNode instanceof HTMLFormElement && rootNode.matches('[data-form="npc"]')) forms.push(rootNode);
    for (const form of queryRoot.querySelectorAll?.('#character-life-overlay form[data-form="npc"]') || []) forms.push(form);

    for (const form of [...new Set(forms)]) {
        const header = form.elements?.headerAccent;
        const thought = form.elements?.thoughtAccent;
        const dialogue = form.elements?.dialogueAccent;
        if (!(header instanceof HTMLInputElement) || !(thought instanceof HTMLInputElement) || !(dialogue instanceof HTMLInputElement)) continue;
        const color = hex(header.value) || nameIdentityColor(form.elements?.name?.value);
        header.value = color;
        thought.value = color;
        dialogue.value = color;
        setLabel(header, 'NPC identity color');
        thought.closest('label')?.classList.add('cl-channel-hidden');
        dialogue.closest('label')?.classList.add('cl-channel-hidden');

        const layout = form.querySelector('[data-cl-color-layout]');
        if (layout instanceof HTMLSelectElement) {
            layout.querySelector('option[value="separate"]')?.remove();
            layout.value = 'unified';
        }
        const note = form.querySelector('[data-cl-color-mode-note]');
        if (note) note.textContent = 'One stable NPC identity color is used for Header, Monologue, Dialogue, portrait accents, and decorations.';
    }
}

function schedulePresentation(delay = 0) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
        try { patchNpcEditor(document); repairRenderedColors(document); }
        catch (error) { console.warn("[Character Life's] v1.9.7 color presentation refresh skipped safely.", error); }
    }, delay);
}

function scheduleReconcile(delay = 80) {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => void reconcileStorage(), delay);
}

function bindDomEvents() {
    document.addEventListener('input', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.matches('#character-life-overlay [name="headerAccent"]')) return;
        const form = target.closest('form[data-form="npc"]'), color = hex(target.value);
        if (!form || !color) return;
        if (form.elements.thoughtAccent) form.elements.thoughtAccent.value = color;
        if (form.elements.dialogueAccent) form.elements.dialogueAccent.value = color;
        schedulePresentation(0);
    }, true);

    document.addEventListener('change', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-overlay')) setTimeout(() => patchNpcEditor(document), 0);
    }, true);

    document.addEventListener('submit', event => {
        const form = event.target instanceof HTMLFormElement ? event.target : null;
        if (!form?.matches('#character-life-overlay form[data-form="npc"]')) return;
        // Capture phase: mirror before the core submit handler builds FormData.
        const color = hex(form.elements.headerAccent?.value);
        if (color) {
            if (form.elements.thoughtAccent) form.elements.thoughtAccent.value = color;
            if (form.elements.dialogueAccent) form.elements.dialogueAccent.value = color;
        }
        setTimeout(() => { scheduleReconcile(80); schedulePresentation(100); }, 0);
    }, true);

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-overlay, #character-life-wand-launcher')) setTimeout(() => patchNpcEditor(document), 0);
    }, true);
}

function bindContextEvents() {
    const c = ctx(), source = c?.eventSource, types = c?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const name of ['CHAT_CHANGED','CHAT_LOADED','MESSAGE_RECEIVED','MESSAGE_EDITED','MESSAGE_SWIPED','CHARACTER_MESSAGE_RENDERED','MORE_MESSAGES_LOADED']) {
        const type = types[name];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => {
            scheduleReconcile(name === 'MESSAGE_RECEIVED' ? 180 : 100);
            schedulePresentation(name === 'CHARACTER_MESSAGE_RENDERED' ? 20 : 120);
        });
    }
    globalThis.addEventListener('character-life:continuity-updated', () => {
        scheduleReconcile(40);
        schedulePresentation(80);
    });
}

function initialize() {
    if (initialized) return;
    initialized = true;
    try {
        bindDomEvents();
        bindContextEvents();
        for (const delay of [0, 220, 850, 1800]) setTimeout(() => { scheduleReconcile(0); schedulePresentation(20); }, delay);
        globalThis.CharacterLifeNpcIdentity = Object.freeze({
            version: CL197_VERSION,
            reconcile: reconcileStorage,
            refreshColors: () => repairRenderedColors(document),
            identityColor: name => {
                const npc = resolveNpc(name);
                return npc ? identityColor(npc) : nameIdentityColor(name);
            },
        });
        console.info("[Character Life's] v1.9.7 canonical NPC scope + unified identity color repair enabled.");
    } catch (error) {
        initialized = false;
        console.error("[Character Life's] v1.9.7 NPC identity repair failed safely.", error);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
