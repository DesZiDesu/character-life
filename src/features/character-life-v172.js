/* global SillyTavern, toastr */

// Character Life v1.7.2 safe Wand enhancer.
// The recovered v1.7.2 entry loads first. This layer uses event delegation only:
// no MutationObserver, no recurring timer, and no core parser/storage replacement.
import './theme-studio-v171.js';

const SETTINGS_KEY = 'character_life';
const CHAT_KEY = 'character_life_npcs';
const DIRECTOR_PROMPT_KEY = 'character_life_portrait_director_v172';
const SCOPES = ['global', 'character', 'chat'];
let initialized = false;
let enhanceQueued = false;
let lastDirectorPrompt = null;

const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const cleanText = (value, fallback = '', max = 1200) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
const uid = prefix => `${prefix || 'cl'}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
const slug = value => cleanText(value, 'default', 80).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '-').replace(/^-|-$/g, '') || 'default';

function notify(type, message) {
    if (typeof toastr !== 'undefined' && typeof toastr[type] === 'function') toastr[type](message, "Character Life's");
    else console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
}

function ctx() { return globalThis.SillyTavern?.getContext?.() || null; }

function rootSettings() {
    const context = ctx();
    if (!context?.extensionSettings) return null;
    const root = context.extensionSettings[SETTINGS_KEY] ||= { config: {}, customDesigns: [], globalNpcs: [], characterNpcs: {} };
    root.config ||= {};
    root.globalNpcs = Array.isArray(root.globalNpcs) ? root.globalNpcs : [];
    root.characterNpcs = root.characterNpcs && typeof root.characterNpcs === 'object' ? root.characterNpcs : {};
    return root;
}

function config() { return rootSettings()?.config || null; }

function characterKey() {
    const context = ctx();
    if (!context) return 'character:unknown';
    const group = context.groupId ?? context.group?.id;
    if (group !== undefined && group !== null && group !== '') return `group:${group}`;
    const characterId = context.characterId ?? context.character?.id;
    const character = context.character || (Array.isArray(context.characters) ? context.characters[characterId] : null);
    const avatar = cleanText(character?.avatar || '', '', 180);
    const name = cleanText(context.name2 || character?.name || 'unknown', 'unknown', 180);
    return `character:${avatar || characterId || name}`;
}

function hasChat() { return Boolean(ctx()?.getCurrentChatId?.()); }

function chatState(create = false) {
    const context = ctx();
    if (!context || !hasChat()) return { version: 1, npcs: [] };
    if (create) context.chatMetadata[CHAT_KEY] ||= { version: 1, npcs: [] };
    const state = context.chatMetadata[CHAT_KEY];
    return state && Array.isArray(state.npcs) ? state : { version: 1, npcs: [] };
}

function rawLibrary(scope, create = false) {
    const root = rootSettings();
    if (!root) return [];
    if (scope === 'global') return root.globalNpcs;
    if (scope === 'character') {
        const key = characterKey();
        if (create) root.characterNpcs[key] ||= [];
        return Array.isArray(root.characterNpcs[key]) ? root.characterNpcs[key] : [];
    }
    if (scope === 'chat') return chatState(create).npcs;
    return [];
}

function setRawLibrary(scope, npcs) {
    const root = rootSettings();
    if (!root) throw new Error('Character Life settings are unavailable.');
    const value = Array.isArray(npcs) ? npcs : [];
    if (scope === 'global') root.globalNpcs = value;
    else if (scope === 'character') root.characterNpcs[characterKey()] = value;
    else if (scope === 'chat') {
        if (!hasChat()) throw new Error('Open a character or group chat first.');
        const state = chatState(true);
        state.npcs = value;
        ctx().chatMetadata[CHAT_KEY] = state;
    }
}

function scopeAvailable(scope) { return scope === 'global' || (SCOPES.includes(scope) && hasChat()); }
function scopeLabel(scope) { return scope === 'global' ? 'Global' : scope === 'character' ? 'Character' : 'Chat'; }

async function persistSettingsNow() {
    const saver = ctx()?.saveSettingsDebounced;
    if (typeof saver !== 'function') return false;
    const queued = saver();
    if (typeof saver.flush === 'function') {
        const flushed = saver.flush();
        if (flushed && typeof flushed.then === 'function') await flushed;
        return true;
    }
    if (queued && typeof queued.then === 'function') {
        await queued;
        return true;
    }
    return false;
}

async function persistScope(scope, npcs) {
    setRawLibrary(scope, npcs);
    if (scope === 'chat') {
        await ctx().saveMetadata();
        return true;
    }
    return persistSettingsNow();
}

function activeScopeFromDom() {
    const active = document.querySelector('#character-life-overlay [data-scope].is-active, #character-life-overlay [data-scope][aria-selected="true"]');
    return SCOPES.includes(active?.dataset.scope) ? active.dataset.scope : 'chat';
}

function selectedNpcIdentity(scope = activeScopeFromDom()) {
    const overlay = document.getElementById('character-life-overlay');
    const id = cleanText(overlay?.querySelector('.cl-npc-row.is-active[data-id]')?.dataset.id || overlay?.querySelector('[data-form="npc"] [name="id"]')?.value, '', 160);
    const visibleName = cleanText(overlay?.querySelector('.cl-profile-hero h3')?.textContent || overlay?.querySelector('[data-form="npc"] [name="name"]')?.value, '', 160);
    const list = rawLibrary(scope);
    let index = id ? list.findIndex(item => cleanText(item?.id, '', 160) === id) : -1;
    if (index < 0 && visibleName) index = list.findIndex(item => cleanText(item?.name, '', 160).toLocaleLowerCase() === visibleName.toLocaleLowerCase());
    return index >= 0 ? { npc: list[index], index, id: cleanText(list[index]?.id, id, 160), name: cleanText(list[index]?.name, visibleName, 160) } : null;
}

function replaceOrAppend(list, npc, conflictIndex = -1) {
    const next = list.map(item => clone(item));
    if (conflictIndex >= 0) next.splice(conflictIndex, 1, npc);
    else next.push(npc);
    return next;
}

function refreshTransferCounts() {
    const overlay = document.getElementById('character-life-overlay');
    for (const scope of SCOPES) {
        const count = overlay?.querySelector(`[data-count="${scope}"]`);
        if (count) count.textContent = String(rawLibrary(scope).length);
    }
}

async function transferNpc(mode) {
    const overlay = document.getElementById('character-life-overlay');
    const sourceScope = activeScopeFromDom();
    const targetScope = cleanText(overlay?.querySelector('[data-copy-scope]')?.value, '', 20);
    if (!SCOPES.includes(targetScope) || targetScope === sourceScope || !scopeAvailable(targetScope)) {
        notify('warning', 'Choose a different available destination scope.');
        return;
    }
    const selected = selectedNpcIdentity(sourceScope);
    if (!selected?.npc) throw new Error('Could not resolve the selected NPC. Close and reopen the Character Life Wand, then try again.');

    const source = rawLibrary(sourceScope).map(item => clone(item));
    const target = rawLibrary(targetScope).map(item => clone(item));
    const lowerName = selected.name.toLocaleLowerCase();
    const conflictIndex = target.findIndex(item => cleanText(item?.name, '', 160).toLocaleLowerCase() === lowerName || (selected.id && cleanText(item?.id, '', 160) === selected.id));
    if (conflictIndex >= 0 && !globalThis.confirm(`${selected.name} already exists in ${scopeLabel(targetScope)}. Replace the existing record?`)) return;

    const transferred = clone(selected.npc);
    const now = new Date().toISOString();
    if (mode === 'copy') {
        transferred.id = uid('npc');
        transferred.createdAt = now;
    }
    transferred.updatedAt = now;
    const nextTarget = replaceOrAppend(target, transferred, conflictIndex);

    if (mode === 'copy') {
        await persistScope(targetScope, nextTarget);
        notify('success', `${selected.name} copied to ${scopeLabel(targetScope)}.`);
        refreshTransferCounts();
        updateDirectorPrompt();
        return;
    }

    const nextSource = source.filter((_, index) => index !== selected.index);
    if (sourceScope !== 'chat' && targetScope !== 'chat') {
        // Both are stored in extension settings: update both and perform one save.
        setRawLibrary(targetScope, nextTarget);
        setRawLibrary(sourceScope, nextSource);
        await persistSettingsNow();
    } else {
        // Cross storage boundary: destination first. Failure can leave a duplicate,
        // but never deletes the only copy of the NPC.
        const targetConfirmed = await persistScope(targetScope, nextTarget);
        if (sourceScope === 'chat' && targetScope !== 'chat' && !targetConfirmed) {
            notify('warning', `${selected.name} was copied to ${scopeLabel(targetScope)}, but this SillyTavern build cannot confirm an immediate settings save. The Chat source was kept for safety.`);
            refreshTransferCounts();
            updateDirectorPrompt();
            return;
        }
        try {
            await persistScope(sourceScope, nextSource);
        } catch (error) {
            notify('warning', `${selected.name} was saved to ${scopeLabel(targetScope)}, but the source could not be removed. The original was kept for safety.`);
            throw error;
        }
    }

    notify('success', `${selected.name} moved to ${scopeLabel(targetScope)}.`);
    refreshTransferCounts();
    updateDirectorPrompt();
    // Let the original Character Life close handler reset its private selection state.
    queueMicrotask(() => overlay?.querySelector('[data-action="close"]')?.click());
}

function ensureDefaults() {
    const cfg = config();
    if (!cfg) return;
    let changed = false;
    if (typeof cfg.unifiedNpcColors !== 'boolean') { cfg.unifiedNpcColors = true; changed = true; }
    if (!cfg.aiPortraitHints || typeof cfg.aiPortraitHints !== 'object' || Array.isArray(cfg.aiPortraitHints)) { cfg.aiPortraitHints = {}; changed = true; }
    if (changed) void persistSettingsNow();
}

function unifiedColorsEnabled() { return config()?.unifiedNpcColors !== false; }

function setUnifiedColors(value) {
    const cfg = config();
    if (!cfg) return;
    const next = Boolean(value);
    const changed = cfg.unifiedNpcColors !== next;
    cfg.unifiedNpcColors = next;
    if (changed) void persistSettingsNow();
    const existing = document.getElementById('character-life-unified-colors');
    if (existing instanceof HTMLInputElement && existing.checked !== next) {
        existing.checked = next;
        existing.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelectorAll('.mes_text.character-life-rendered').forEach(message => { message.dataset.clUnifiedColors = next ? 'true' : 'false'; });
}

function setLabelText(label, text) {
    const span = label?.querySelector(':scope > span');
    if (span) span.textContent = text;
}

function syncColorEditor(form) {
    const layout = form.querySelector('[data-cl-color-layout]');
    const header = form.elements.headerAccent;
    const thought = form.elements.thoughtAccent;
    const dialogue = form.elements.dialogueAccent;
    if (!layout || !header || !thought || !dialogue) return;
    const unified = layout.value !== 'separate';
    setUnifiedColors(unified);
    setLabelText(header.closest('label'), unified ? 'NPC identity color' : 'Header accent');
    thought.closest('label')?.classList.toggle('cl-channel-hidden', unified);
    dialogue.closest('label')?.classList.toggle('cl-channel-hidden', unified);
    const note = form.querySelector('[data-cl-color-mode-note]');
    if (note) note.textContent = unified
        ? 'One stable NPC color is used for Header, Monologue, Dialogue, portrait accents, and decorations. Separate saved colors are not erased.'
        : 'Header, Monologue, and Dialogue can use different colors.';
}

function enhanceColorEditor(form) {
    if (form.dataset.clColorEnhanced === 'true') { syncColorEditor(form); return; }
    const themeMode = form.elements.themeMode;
    const header = form.elements.headerAccent;
    const thought = form.elements.thoughtAccent;
    const dialogue = form.elements.dialogueAccent;
    if (!themeMode || !header || !thought || !dialogue) return;
    const anchor = themeMode.closest('label');
    if (!anchor?.parentElement) return;
    const panel = document.createElement('section');
    panel.className = 'cl-color-identity-panel wide';
    panel.innerHTML = `<header><i class="fa-solid fa-palette"></i><span>NPC COLOR IDENTITY</span></header>
        <div class="cl-color-identity-controls"><label><span>Color layout</span><select data-cl-color-layout>
        <option value="unified">One color for all UI (Default)</option><option value="separate">Separate Header / Monologue / Dialogue</option>
        </select></label><button type="button" class="cl-ai-identity-color" data-cl-action="ai-color"><i class="fa-solid fa-wand-magic-sparkles"></i><span>AI choose identity color</span></button></div>
        <small data-cl-color-mode-note></small><div class="cl-ai-color-result" data-cl-ai-color-result hidden></div>`;
    anchor.parentElement.insertBefore(panel, anchor);
    panel.querySelector('[data-cl-color-layout]').value = unifiedColorsEnabled() ? 'unified' : 'separate';
    form.dataset.clColorEnhanced = 'true';
    syncColorEditor(form);
}

function draftFromForm(form) {
    const fields = ['name', 'aliases', 'pronouns', 'gender', 'age', 'species', 'role', 'affiliation', 'appearance', 'personality', 'relationship', 'background', 'goals', 'abilities', 'speechStyle', 'currentState', 'notes'];
    return fields.map(field => {
        const value = cleanText(form.elements[field]?.value, '', 1400).replace(/\s+/g, ' ');
        return value ? `${field}: ${value}` : '';
    }).filter(Boolean).join('\n');
}

async function chooseIdentityColor(button) {
    const form = button.closest('[data-form="npc"]');
    if (!form) return;
    const generator = ctx()?.generateQuietPrompt;
    if (typeof generator !== 'function') throw new Error('This SillyTavern build does not expose quiet AI generation to extensions.');
    const name = cleanText(form.elements.name?.value, 'Unknown NPC', 120);
    const prompt = `CHARACTER LIFE — NPC IDENTITY COLOR DIRECTOR\nChoose ONE persistent identity accent color for the fictional NPC below. This color is used for the NPC Header, Monologue, Dialogue, portrait accents, and small decorative UI.\n\nChoose from established character identity rather than randomly. Priority: (1) canonical or persistent visual motifs supported by the profile/current conversation; (2) signature hair, magic, emblem, faction, species, or iconic long-term clothing; (3) durable personality/lore symbolism only when visually appropriate; (4) portrait palette as a supporting clue, not the sole authority. Ignore temporary lighting/background colors. Keep the choice stable across scenes unless the user explicitly asks to change it. Choose a display-safe accent visible on dark and light UI; avoid pure black and pure white.\n\nCalibration examples only, never hard-code by name: a Rudeus-like character can fit warm earth brown or muted gold; a Sylphiette-like character can fit pale green, soft mint, or warm ivory.\n\nReturn ONLY this format:\n#RRGGBB | short color label\n\nNPC: ${name}\n${draftFromForm(form) || 'No additional profile fields are filled yet. Use the current conversation and character identity if known.'}`;
    button.disabled = true;
    button.classList.add('is-working');
    try {
        const result = cleanText(await generator(prompt), '', 500);
        const match = result.match(/#[0-9a-f]{6}/i);
        if (!match || !validHex(match[0])) throw new Error('AI did not return a valid #RRGGBB color. No existing color was changed.');
        const color = match[0].toUpperCase();
        const label = cleanText(result.split('|').slice(1).join('|'), 'AI identity color', 80);
        form.elements.themeMode.value = 'custom';
        for (const field of ['headerAccent', 'thoughtAccent', 'dialogueAccent']) {
            const input = form.elements[field];
            if (!input) continue;
            input.value = color;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const output = form.querySelector('[data-cl-ai-color-result]');
        if (output) {
            output.hidden = false;
            output.innerHTML = `<span style="--cl-ai-picked:${escapeHtml(color)}"></span><strong>${escapeHtml(color)}</strong><em>${escapeHtml(label)}</em>`;
        }
        notify('success', `${name}: ${color} — ${label}`);
    } finally {
        button.disabled = false;
        button.classList.remove('is-working');
    }
}

function portraitHints() {
    const cfg = config();
    if (!cfg) return {};
    cfg.aiPortraitHints ||= {};
    return cfg.aiPortraitHints;
}

function hintForPortrait(portraitId) {
    const value = portraitHints()[portraitId];
    return typeof value === 'string' ? value : cleanText(value?.description, '', 260);
}

function savePortraitHint(portraitId, description) {
    if (!portraitId) return;
    const hints = portraitHints();
    const text = cleanText(description, '', 260);
    if (text) hints[portraitId] = { description: text, updatedAt: new Date().toISOString() };
    else delete hints[portraitId];
    void persistSettingsNow();
    updateDirectorPrompt();
}

function enhancePortraitCard(card) {
    if (card.dataset.clAiPortraitEnhanced === 'true') return;
    const portraitId = cleanText(card.querySelector('[data-portrait-id]')?.dataset.portraitId, '', 180);
    const formName = cleanText(card.querySelector('input[name="name"]')?.value || card.querySelector('.cl-form-copy strong')?.textContent, 'Portrait form', 120);
    const host = card.querySelector('.cl-form-copy');
    if (!portraitId || !host) return;
    const panel = document.createElement('div');
    panel.className = 'cl-portrait-ai-panel';
    panel.dataset.portraitId = portraitId;
    panel.innerHTML = `<label><span>Scene / appearance hint</span><textarea rows="2" maxlength="260" data-cl-portrait-hint placeholder="Example: Ranoa Academy uniform; use for university classes and campus scenes.">${escapeHtml(hintForPortrait(portraitId))}</textarea></label>
        <div><button type="button" data-cl-action="analyze-portrait"><i class="fa-solid fa-eye"></i><span>AI analyze portrait</span></button><small>Helps the main roleplay AI choose between ${escapeHtml(formName)} and other saved portraits. It can only select images already saved for this NPC.</small></div>`;
    host.append(panel);
    card.dataset.clAiPortraitEnhanced = 'true';
}

function openPortraitDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('character-life-portraits', 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains('portraits')) request.result.createObjectStore('portraits', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open portrait storage.'));
    });
}

async function portraitBlob(portraitId) {
    if (!portraitId) return null;
    const db = await openPortraitDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction('portraits', 'readonly').objectStore('portraits').get(portraitId);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error || new Error('Could not read the portrait.'));
    });
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read portrait image.'));
        reader.readAsDataURL(blob);
    });
}

async function analyzePortrait(button) {
    const panel = button.closest('.cl-portrait-ai-panel');
    const portraitId = cleanText(panel?.dataset.portraitId, '', 180);
    const textarea = panel?.querySelector('[data-cl-portrait-hint]');
    if (!portraitId || !textarea) return;
    const blob = await portraitBlob(portraitId);
    if (!blob) throw new Error('This portrait image is not available on this device.');
    button.disabled = true;
    button.classList.add('is-working');
    try {
        const source = await blobToDataUrl(blob);
        const { getMultimodalCaption } = await import('/scripts/extensions/shared.js');
        const prompt = `Analyze this image only as a selectable visual form for Character Life. Return one concise phrase, maximum 220 characters, describing only details useful for choosing this portrait during roleplay: apparent age/form if visually distinguishable, hair/state changes, clothing or uniform, armor/equipment, and the role or setting suggested by visible attire. Do not infer personality, nationality, ethnicity, diagnosis, or real-person identity. No headings or bullet points.`;
        const result = cleanText(await getMultimodalCaption(source, prompt), '', 220);
        if (!result) throw new Error('The image-caption model returned an empty result.');
        textarea.value = result;
        savePortraitHint(portraitId, result);
        notify('success', 'Portrait selection hint saved.');
    } catch (error) {
        throw new Error(`Portrait analysis failed. Configure SillyTavern's multimodal Image Captioning model first. ${error.message}`);
    } finally {
        button.disabled = false;
        button.classList.remove('is-working');
    }
}

function enhanceTransferPanel(overlay) {
    const panel = overlay.querySelector('.cl-copy-panel');
    if (!panel || panel.dataset.clTransferEnhanced === 'true') return;
    panel.classList.add('cl-transfer-panel');
    panel.dataset.clTransferEnhanced = 'true';
    const label = panel.querySelector('label');
    if (label) {
        const select = label.querySelector('select');
        label.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = ''; });
        if (!label.querySelector('.cl-transfer-label')) label.insertAdjacentHTML('afterbegin', '<span class="cl-transfer-label">Transfer NPC</span>');
        if (select) select.setAttribute('aria-label', 'Destination scope');
    }
    const copy = panel.querySelector('[data-action="copy-npc"]');
    if (copy) {
        copy.innerHTML = '<i class="fa-solid fa-copy"></i><span>Copy</span>';
        copy.dataset.clTransfer = 'copy';
    }
    if (!panel.querySelector('[data-cl-transfer="move"]')) {
        const move = document.createElement('button');
        move.type = 'button';
        move.dataset.clTransfer = 'move';
        move.className = 'cl-transfer-move';
        move.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i><span>Move</span>';
        panel.append(move);
    }
    if (!panel.querySelector('.cl-transfer-note')) panel.insertAdjacentHTML('beforeend', '<small class="cl-transfer-note">Move saves the destination first. If source cleanup fails, Character Life keeps the original rather than risking data loss.</small>');
}

function enhanceWand() {
    enhanceQueued = false;
    const overlay = document.getElementById('character-life-overlay');
    if (!overlay) return;
    const form = overlay.querySelector('[data-form="npc"]');
    if (form) enhanceColorEditor(form);
    enhanceTransferPanel(overlay);
    overlay.querySelectorAll('.cl-form-card').forEach(enhancePortraitCard);
    refreshTransferCounts();
}

function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    queueMicrotask(enhanceWand);
}

function effectiveNpcRecords() {
    const merged = new Map();
    for (const scope of SCOPES) {
        if (!scopeAvailable(scope) && scope !== 'global') continue;
        for (const npc of rawLibrary(scope)) {
            const name = cleanText(npc?.name, '', 120);
            if (name) merged.set(name.toLocaleLowerCase(), npc);
        }
    }
    return [...merged.values()];
}

function updateDirectorPrompt() {
    const context = ctx();
    if (!context?.setExtensionPrompt) return;
    if (!hasChat()) {
        if (lastDirectorPrompt !== '') context.setExtensionPrompt(DIRECTOR_PROMPT_KEY, '', 1, 1, false, 0);
        lastDirectorPrompt = '';
        return;
    }
    const hints = portraitHints();
    const records = [];
    let length = 0;
    for (const npc of effectiveNpcRecords()) {
        const forms = Array.isArray(npc?.forms) ? npc.forms.filter(form => cleanText(form?.name) && cleanText(form?.portraitId)) : [];
        if (forms.length < 2) continue;
        const described = forms.map(form => {
            const formSlug = slug(form.name);
            const stored = hints[form.portraitId];
            const hint = cleanText(typeof stored === 'string' ? stored : stored?.description, '', 220);
            return `${formSlug} = ${hint || cleanText(form.name, formSlug, 100)}`;
        });
        const record = `- ${cleanText(npc.name, 'NPC', 120)}: ${described.join('; ')}`;
        if (length + record.length > 9000) break;
        records.push(record);
        length += record.length;
    }
    const prompt = records.length ? `CHARACTER LIFE PORTRAIT FORM DIRECTOR\nFor saved NPCs with multiple available portrait forms, choose the form whose description best matches the NPC's current age/form, clothing, equipment, location, era, or role in the present scene. Use the SAME form consistently for that speaker's CL_THOUGHT, CL_HEADER, and CL_DIALOGUE blocks in the same turn. If no listed form clearly fits, OMIT the form so Character Life uses the manually active portrait. Never invent a form, portrait, URL, outfit, or image that is not listed. Do not switch portraits merely because mood or emotion changes.\n\nAVAILABLE PORTRAIT FORMS:\n${records.join('\n')}` : '';
    if (prompt === lastDirectorPrompt) return;
    context.setExtensionPrompt(DIRECTOR_PROMPT_KEY, prompt, 1, 1, false, 0);
    lastDirectorPrompt = prompt;
}

function onDocumentClickCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const transfer = target.closest('[data-cl-transfer], [data-action="copy-npc"]');
    if (transfer?.closest('#character-life-overlay')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void transferNpc(transfer.dataset.clTransfer || 'copy').catch(error => notify('error', error.message));
        return;
    }
    const action = target.closest('[data-cl-action]');
    if (action?.closest('#character-life-overlay')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (action.dataset.clAction === 'ai-color') void chooseIdentityColor(action).catch(error => notify('error', error.message));
        else if (action.dataset.clAction === 'analyze-portrait') void analyzePortrait(action).catch(error => notify('error', error.message));
        return;
    }
    queueEnhance();
    queueMicrotask(updateDirectorPrompt);
}

function onDocumentChangeCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const form = target.closest('[data-form="npc"]');
    if (form && target.matches('[data-cl-color-layout]')) syncColorEditor(form);
    if (target.matches('[data-cl-portrait-hint]')) {
        const panel = target.closest('.cl-portrait-ai-panel');
        savePortraitHint(cleanText(panel?.dataset.portraitId, '', 180), target.value);
    }
    queueEnhance();
    queueMicrotask(updateDirectorPrompt);
}

function bindContextEvents() {
    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_RECEIVED']) {
        const type = types[key];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => { queueEnhance(); updateDirectorPrompt(); });
    }
}

function init() {
    if (initialized) return;
    initialized = true;
    try {
        ensureDefaults();
        document.documentElement.setAttribute('data-cl-wand-v172', 'true');
        document.addEventListener('click', onDocumentClickCapture, true);
        document.addEventListener('change', onDocumentChangeCapture, true);
        document.addEventListener('submit', () => { queueEnhance(); queueMicrotask(updateDirectorPrompt); }, true);
        bindContextEvents();
        queueEnhance();
        updateDirectorPrompt();
    } catch (error) {
        console.error("[Character Life's] v1.7.2 Wand enhancer failed safely; core Character Life remains loaded.", error);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
