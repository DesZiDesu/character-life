/* global SillyTavern, toastr */

// Character Life v1.7.2 persistent media layer.
// Keeps portrait/skill images in SillyTavern server storage, with IndexedDB as a fast local cache.
// No MutationObserver or recurring timers.

const SETTINGS_KEY = 'character_life';
const CHAT_KEY = 'character_life_npcs';
const DB_NAME = 'character-life-portraits';
const DB_STORE = 'portraits';
const MEDIA_VERSION = 1;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1400;

let initialized = false;
let migrationQueued = false;
let migrationRunning = false;
let enhanceQueued = false;
let savePromise = Promise.resolve();

const cleanText = (value, fallback = '', max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;
const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function ctx() {
    return globalThis.SillyTavern?.getContext?.() || null;
}

function notify(type, message) {
    if (typeof toastr !== 'undefined' && typeof toastr[type] === 'function') toastr[type](message, "Character Life's");
    else console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
}

function rootSettings() {
    const context = ctx();
    if (!context?.extensionSettings) return null;
    const root = context.extensionSettings[SETTINGS_KEY] ||= { config: {}, customDesigns: [], globalNpcs: [], characterNpcs: {} };
    root.config ||= {};
    root.globalNpcs = Array.isArray(root.globalNpcs) ? root.globalNpcs : [];
    root.characterNpcs = root.characterNpcs && typeof root.characterNpcs === 'object' ? root.characterNpcs : {};
    return root;
}

function mediaState() {
    const root = rootSettings();
    if (!root) return null;
    const state = root.config.persistentMedia ||= { version: MEDIA_VERSION, assets: {} };
    state.version = MEDIA_VERSION;
    state.assets = state.assets && typeof state.assets === 'object' && !Array.isArray(state.assets) ? state.assets : {};
    return state;
}

async function persistSettingsNow() {
    const context = ctx();
    const saver = context?.saveSettingsDebounced;
    if (typeof saver !== 'function') return false;
    const queued = saver();
    if (typeof saver.flush === 'function') {
        const flushed = saver.flush();
        if (flushed && typeof flushed.then === 'function') await flushed;
        return true;
    }
    if (queued && typeof queued.then === 'function') await queued;
    return true;
}

function chatNpcs() {
    const context = ctx();
    if (!context?.getCurrentChatId?.()) return [];
    const state = context.chatMetadata?.[CHAT_KEY];
    return Array.isArray(state?.npcs) ? state.npcs : [];
}

function allKnownNpcs() {
    const root = rootSettings();
    if (!root) return [];
    const list = [...root.globalNpcs];
    for (const library of Object.values(root.characterNpcs)) {
        if (Array.isArray(library)) list.push(...library);
    }
    list.push(...chatNpcs());
    return list;
}

function allPortraitIds() {
    return [...new Set(allKnownNpcs().flatMap(npc =>
        Array.isArray(npc?.forms) ? npc.forms.map(form => cleanText(form?.portraitId, '', 180)).filter(Boolean) : []
    ))];
}

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Could not open Character Life image cache.'));
    });
}

async function localGet(assetId) {
    if (!assetId) return null;
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(assetId);
        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error || new Error('Could not read Character Life image cache.'));
    });
}

async function localPut(assetId, blob) {
    if (!assetId || !(blob instanceof Blob)) return;
    const db = await openDb();
    await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, 'readwrite');
        transaction.objectStore(DB_STORE).put({ id: assetId, blob, updatedAt: new Date().toISOString() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not write Character Life image cache.'));
    });
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read image.'));
        reader.readAsDataURL(blob);
    });
}

async function requestHeaders() {
    const module = await import('/script.js');
    if (typeof module.getRequestHeaders !== 'function') throw new Error('SillyTavern request headers are unavailable.');
    return module.getRequestHeaders();
}

async function uploadBlob(assetId, blob, kind = 'portrait') {
    const dataUrl = await blobToDataUrl(blob);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const safeId = cleanText(assetId, 'asset', 100).replace(/[^a-z0-9_-]/gi, '-');
    const name = `character-life-${kind}-${safeId}-${Date.now()}.${ext}`;
    const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: await requestHeaders(),
        body: JSON.stringify({ name, data: base64 }),
    });
    if (!response.ok) throw new Error(`Server image upload failed (${response.status}).`);
    const result = await response.json();
    const path = cleanText(result?.path, '', 1000);
    if (!path) throw new Error('SillyTavern did not return a persistent image path.');
    return path;
}

async function deleteServerFile(path) {
    if (!path) return false;
    try {
        const response = await fetch('/api/files/delete', {
            method: 'POST',
            headers: await requestHeaders(),
            body: JSON.stringify({ path }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function serverBlob(path) {
    if (!path) return null;
    const response = await fetch(path, { method: 'GET', cache: 'no-cache', credentials: 'same-origin' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob?.size ? blob : null;
}

function mapping(assetId) {
    return mediaState()?.assets?.[assetId] || null;
}

async function saveMapping(assetId, path, blob, kind = 'portrait') {
    const state = mediaState();
    if (!state) throw new Error('Character Life settings are unavailable.');
    state.assets[assetId] = {
        path,
        kind,
        mime: cleanText(blob?.type, 'image/webp', 80),
        size: Number(blob?.size) || 0,
        updatedAt: new Date().toISOString(),
    };
    savePromise = savePromise.catch(() => undefined).then(() => persistSettingsNow());
    await savePromise;
    return state.assets[assetId];
}

async function imageFromFile(file) {
    if (!(file instanceof Blob)) throw new Error('Choose an image file.');
    if (file instanceof File && file.type && !file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 20 MB.');
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Could not decode the selected image.'));
            image.src = url;
        });
        const sourceWidth = Math.max(1, image.naturalWidth || image.width);
        const sourceHeight = Math.max(1, image.naturalHeight || image.height);
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) return file;
        context.drawImage(image, 0, 0, width, height);
        const webp = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
        return webp || file;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function ensurePersistentImage(assetId) {
    const id = cleanText(assetId, '', 180);
    if (!id) return null;
    const local = await localGet(id).catch(() => null);
    const saved = mapping(id);
    if (local && saved?.path) return { blob: local, path: saved.path, mapping: saved };
    if (!local && saved?.path) {
        const fetched = await serverBlob(saved.path);
        if (fetched) {
            await localPut(id, fetched);
            return { blob: fetched, path: saved.path, mapping: saved };
        }
        return null;
    }
    if (local && !saved?.path) {
        const path = await uploadBlob(id, local, 'portrait');
        const next = await saveMapping(id, path, local, 'portrait');
        return { blob: local, path, mapping: next };
    }
    return null;
}

export async function storePersistentImage(assetId, fileOrBlob, { kind = 'portrait' } = {}) {
    const id = cleanText(assetId, '', 180);
    if (!id) throw new Error('Missing image asset id.');
    const blob = await imageFromFile(fileOrBlob);
    const oldPath = mapping(id)?.path || '';
    await localPut(id, blob);
    const path = await uploadBlob(id, blob, kind);
    await saveMapping(id, path, blob, kind);
    if (oldPath && oldPath !== path) void deleteServerFile(oldPath);
    return { blob, path };
}

export async function persistentImagePath(assetId) {
    const id = cleanText(assetId, '', 180);
    if (!id) return '';
    const saved = mapping(id);
    if (saved?.path) return saved.path;
    const ensured = await ensurePersistentImage(id);
    return ensured?.path || '';
}

export async function removePersistentImage(assetId) {
    const id = cleanText(assetId, '', 180);
    if (!id) return false;
    const state = mediaState();
    const oldPath = state?.assets?.[id]?.path || '';
    if (state?.assets?.[id]) {
        delete state.assets[id];
        await persistSettingsNow();
    }
    if (oldPath) void deleteServerFile(oldPath);
    return true;
}

async function migrateAndHydrate() {
    if (migrationRunning) return;
    migrationRunning = true;
    try {
        let uploaded = 0;
        let hydrated = 0;
        for (const id of allPortraitIds()) {
            const saved = mapping(id);
            const local = await localGet(id).catch(() => null);
            if (saved?.path && !local) {
                const fetched = await serverBlob(saved.path);
                if (fetched) {
                    await localPut(id, fetched);
                    hydrated += 1;
                }
            } else if (!saved?.path && local) {
                try {
                    const path = await uploadBlob(id, local, 'portrait');
                    await saveMapping(id, path, local, 'portrait');
                    uploaded += 1;
                } catch (error) {
                    console.warn("[Character Life's] Portrait server migration skipped for one image.", error);
                }
            }
        }
        if (uploaded || hydrated) {
            console.info(`[Character Life's] Persistent portrait media: ${uploaded} migrated, ${hydrated} restored.`);
            if (hydrated) await rerenderVisibleMessages();
        }
    } finally {
        migrationRunning = false;
    }
}

function queueMigration(delay = 250) {
    if (migrationQueued) return;
    migrationQueued = true;
    setTimeout(() => {
        migrationQueued = false;
        void migrateAndHydrate();
    }, delay);
}

async function rerenderVisibleMessages() {
    const context = ctx();
    if (!context?.chat) return;
    const eventType = context.eventTypes?.CHARACTER_MESSAGE_RENDERED;
    for (const element of document.querySelectorAll('#chat .mes[mesid]')) {
        const id = Number(element.getAttribute('mesid'));
        const message = context.chat[id];
        if (!Number.isInteger(id) || !message) continue;
        try {
            if (typeof context.updateMessageBlock === 'function') context.updateMessageBlock(id, message);
            if (eventType && context.eventSource?.emit) await context.eventSource.emit(eventType, id);
        } catch (error) {
            console.warn("[Character Life's] Could not re-render restored portrait.", error);
        }
    }
}

function currentPortraitId(card) {
    return cleanText(card?.querySelector('[data-portrait-id]')?.dataset.portraitId, '', 180);
}

async function syncCardState(card) {
    if (!card?.isConnected) return;
    const portraitId = currentPortraitId(card);
    if (!portraitId) return;
    const button = card.querySelector('[data-cl-media-action="replace"]');
    const badge = card.querySelector('[data-cl-media-status]');
    const local = await localGet(portraitId).catch(() => null);
    const saved = mapping(portraitId);
    const hasImage = Boolean(local || saved?.path);
    if (button) {
        button.innerHTML = `<i class="fa-solid fa-image"></i><span>${hasImage ? 'Replace image' : 'Select image'}</span>`;
        button.title = hasImage ? 'Choose a new image for this existing portrait slot.' : 'Reconnect an image to this existing portrait slot.';
    }
    if (badge) {
        badge.textContent = saved?.path ? 'Server saved' : local ? 'Migration pending' : 'Image missing';
        badge.dataset.state = saved?.path ? 'server' : local ? 'local' : 'missing';
    }
}

function enhancePortraitCard(card) {
    if (!(card instanceof Element)) return;
    if (card.dataset.clPersistentMedia === 'true') {
        void syncCardState(card);
        return;
    }
    const portraitId = currentPortraitId(card);
    const form = card.querySelector('form[data-form="framing"]');
    if (!portraitId || !form) return;
    const controls = form.querySelector(':scope > div') || form;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.clMediaAction = 'replace';
    button.innerHTML = '<i class="fa-solid fa-image"></i><span>Replace image</span>';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    input.dataset.clMediaInput = portraitId;
    const badge = document.createElement('small');
    badge.className = 'cl-media-storage-status';
    badge.dataset.clMediaStatus = '';
    controls.append(button, input, badge);
    card.dataset.clPersistentMedia = 'true';
    void syncCardState(card);
}

function enhanceWandPortraits() {
    enhanceQueued = false;
    const overlay = document.getElementById('character-life-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('.cl-form-card').forEach(enhancePortraitCard);
}

function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    queueMicrotask(enhanceWandPortraits);
}

function refreshImagesInDom(assetId, blob) {
    const url = URL.createObjectURL(blob);
    document.querySelectorAll(`[data-portrait-id="${CSS.escape(assetId)}"]`).forEach(frame => {
        const image = frame.querySelector('img');
        if (!image) return;
        image.src = url;
        image.hidden = false;
        frame.classList.add('has-image');
    });
    setTimeout(() => URL.revokeObjectURL(url), 15000);
}

async function replacePortrait(input) {
    const file = input.files?.[0];
    const assetId = cleanText(input.dataset.clMediaInput, '', 180);
    input.value = '';
    if (!file || !assetId) return;
    const result = await storePersistentImage(assetId, file, { kind: 'portrait' });
    refreshImagesInDom(assetId, result.blob);
    const card = input.closest('.cl-form-card');
    if (card) await syncCardState(card);
    notify('success', 'Portrait image replaced and saved on the SillyTavern server.');
    globalThis.dispatchEvent(new CustomEvent('character-life:portrait-replaced', { detail: { portraitId: assetId, path: result.path } }));
}

function onClickCapture(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const button = target.closest('[data-cl-media-action="replace"]');
    if (button?.closest('#character-life-overlay')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        button.parentElement?.querySelector('[data-cl-media-input]')?.click();
        return;
    }
    queueEnhance();
    queueMigration(350);
}

function onChangeCapture(event) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches('[data-cl-media-input]')) {
        event.stopImmediatePropagation();
        void replacePortrait(target).catch(error => notify('error', error.message));
        return;
    }
    queueEnhance();
    queueMigration(450);
}

function bindContextEvents() {
    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED']) {
        const type = types[key];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => {
            queueEnhance();
            queueMigration(key === 'CHAT_CHANGED' ? 120 : 500);
        });
    }
}

function exposeApi() {
    globalThis.CharacterLifeMedia = Object.freeze({
        version: '1.7.2',
        ensure: ensurePersistentImage,
        store: storePersistentImage,
        path: persistentImagePath,
        remove: removePersistentImage,
    });
}

function init() {
    if (initialized) return;
    initialized = true;
    try {
        document.addEventListener('click', onClickCapture, true);
        document.addEventListener('change', onChangeCapture, true);
        document.addEventListener('submit', () => { queueEnhance(); queueMigration(500); }, true);
        bindContextEvents();
        exposeApi();
        queueEnhance();
        queueMigration(700);
    } catch (error) {
        console.error("[Character Life's] Persistent media layer failed safely.", error);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
