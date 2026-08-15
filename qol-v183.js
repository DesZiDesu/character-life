/* global SillyTavern, toastr */

// Character Life v1.8.3 — native notifications + bulk NPC scope movement.
const CL183_VERSION = '1.8.3';
const CL183_SETTINGS_KEY = 'character_life';
const CL183_CHAT_KEY = 'character_life_npcs';
const CL183_TOAST_TYPES = ['success', 'info', 'warning', 'error'];
const CL183_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

let cl183BulkMode = false;
let cl183BulkSelected = new Set();
let cl183UiQueued = false;
let cl183Observer = null;
let cl183ToastrTimer = null;

function cl183Ctx() {
    return globalThis.SillyTavern?.getContext?.() || null;
}

function cl183Root() {
    const context = cl183Ctx();
    if (!context?.extensionSettings) return null;
    const root = context.extensionSettings[CL183_SETTINGS_KEY] ||= { config: {}, customDesigns: [], globalNpcs: [], characterNpcs: {} };
    root.config ||= {};
    root.globalNpcs = Array.isArray(root.globalNpcs) ? root.globalNpcs : [];
    root.characterNpcs = root.characterNpcs && typeof root.characterNpcs === 'object' ? root.characterNpcs : {};
    const qol = root.qol ||= {};
    const notifications = qol.notifications ||= {};
    if (!['character-life', 'sillytavern', 'off'].includes(notifications.mode)) notifications.mode = 'character-life';
    if (!CL183_POSITIONS.includes(notifications.position)) notifications.position = 'top-center';
    if (!Number.isFinite(Number(notifications.duration))) notifications.duration = 3600;
    notifications.duration = Math.max(1800, Math.min(8000, Number(notifications.duration)));
    return root;
}

function cl183Notifications() {
    return cl183Root()?.qol?.notifications || { mode: 'character-life', position: 'top-center', duration: 3600 };
}

function cl183HasChat() {
    return Boolean(cl183Ctx()?.getCurrentChatId?.());
}

function cl183CharacterKey() {
    const context = cl183Ctx();
    if (!context) return 'character:unknown';
    const group = context.groupId ?? context.group?.id;
    if (group !== undefined && group !== null && group !== '') return `group:${group}`;
    const characterId = context.characterId ?? context.character?.id;
    const character = context.character || (Array.isArray(context.characters) ? context.characters[characterId] : null);
    const avatar = String(character?.avatar || '').trim().slice(0, 180);
    const name = String(context.name2 || character?.name || 'unknown').trim().slice(0, 180) || 'unknown';
    return `character:${avatar || characterId || name}`;
}

function cl183ChatState(create = false) {
    const context = cl183Ctx();
    if (!context || !cl183HasChat()) return { version: 1, npcs: [] };
    if (create) context.chatMetadata[CL183_CHAT_KEY] ||= { version: 1, npcs: [] };
    const state = context.chatMetadata[CL183_CHAT_KEY];
    if (!state || !Array.isArray(state.npcs)) {
        if (!create) return { version: 1, npcs: [] };
        context.chatMetadata[CL183_CHAT_KEY] = { version: 1, npcs: [] };
        return context.chatMetadata[CL183_CHAT_KEY];
    }
    return state;
}

function cl183Library(scope, create = false) {
    const root = cl183Root();
    if (!root) return [];
    if (scope === 'global') return root.globalNpcs;
    if (scope === 'character') {
        const key = cl183CharacterKey();
        if (create) root.characterNpcs[key] ||= [];
        return Array.isArray(root.characterNpcs[key]) ? root.characterNpcs[key] : [];
    }
    return cl183ChatState(create).npcs;
}

function cl183SetLibrary(scope, npcs) {
    const root = cl183Root();
    if (!root) return;
    const value = Array.isArray(npcs) ? npcs : [];
    if (scope === 'global') root.globalNpcs = value;
    else if (scope === 'character') root.characterNpcs[cl183CharacterKey()] = value;
    else {
        const state = cl183ChatState(true);
        state.npcs = value;
        cl183Ctx().chatMetadata[CL183_CHAT_KEY] = state;
    }
}

async function cl183Persist(scopes = []) {
    const context = cl183Ctx();
    if (!context) return;
    const changed = new Set(scopes);
    if (changed.has('chat') && typeof context.saveMetadata === 'function') await context.saveMetadata();
    if ((changed.has('global') || changed.has('character')) && typeof context.saveSettingsDebounced === 'function') {
        const queued = context.saveSettingsDebounced();
        if (typeof context.saveSettingsDebounced.flush === 'function') {
            const flushed = context.saveSettingsDebounced.flush();
            if (flushed && typeof flushed.then === 'function') await flushed;
        } else if (queued && typeof queued.then === 'function') await queued;
    }
}

async function cl183PersistSettings() {
    const context = cl183Ctx();
    if (!context || typeof context.saveSettingsDebounced !== 'function') return;
    const queued = context.saveSettingsDebounced();
    if (typeof context.saveSettingsDebounced.flush === 'function') {
        const flushed = context.saveSettingsDebounced.flush();
        if (flushed && typeof flushed.then === 'function') await flushed;
    } else if (queued && typeof queued.then === 'function') await queued;
}

function cl183Escape(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function cl183ToastIcon(type) {
    if (type === 'success') return 'fa-check';
    if (type === 'warning') return 'fa-triangle-exclamation';
    if (type === 'error') return 'fa-xmark';
    return 'fa-feather-pointed';
}

function cl183ToastHost() {
    let host = document.getElementById('character-life-notifications');
    if (!host) {
        host = document.createElement('div');
        host.id = 'character-life-notifications';
        host.className = 'cl-native-notifications';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-atomic', 'false');
        document.body.appendChild(host);
    }
    const position = cl183Notifications().position;
    host.dataset.position = CL183_POSITIONS.includes(position) ? position : 'top-center';
    return host;
}

function cl183DismissToast(toast) {
    if (!(toast instanceof HTMLElement) || toast.dataset.clClosing === 'true') return;
    toast.dataset.clClosing = 'true';
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 220);
}

function cl183ShowToast(type = 'info', message = '', options = {}) {
    const config = cl183Notifications();
    if (config.mode === 'off' && !options.force) return null;
    const host = cl183ToastHost();
    const toast = document.createElement('article');
    const safeType = CL183_TOAST_TYPES.includes(type) ? type : 'info';
    toast.className = `cl-native-toast is-${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
    const title = String(options.title || "Character Life's");
    toast.innerHTML = `<span class="cl-native-toast-icon"><i class="fa-solid ${cl183ToastIcon(safeType)}"></i></span>
        <span class="cl-native-toast-copy"><strong>${cl183Escape(title)}</strong><span>${cl183Escape(message)}</span></span>
        <button type="button" class="cl-native-toast-close" aria-label="Dismiss notification"><i class="fa-solid fa-xmark"></i></button>
        <span class="cl-native-toast-progress"></span>`;
    host.appendChild(toast);
    toast.querySelector('.cl-native-toast-close')?.addEventListener('click', () => cl183DismissToast(toast));
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    const duration = Math.max(1800, Math.min(8000, Number(options.duration || config.duration || 3600)));
    toast.style.setProperty('--cl-toast-duration', `${duration}ms`);
    setTimeout(() => cl183DismissToast(toast), duration);
    while (host.children.length > 5) cl183DismissToast(host.firstElementChild);
    return toast;
}

function cl183IsOwnToast(title) {
    return typeof title === 'string' && /^Character Life(?:'s)?$/i.test(title.trim());
}

function cl183InstallToastrBridge() {
    const target = globalThis.toastr;
    if (!target) {
        if (!cl183ToastrTimer) cl183ToastrTimer = setTimeout(() => { cl183ToastrTimer = null; cl183InstallToastrBridge(); }, 250);
        return;
    }
    if (target.__characterLife183Wrapped) return;
    Object.defineProperty(target, '__characterLife183Wrapped', { configurable: true, value: true });
    for (const type of CL183_TOAST_TYPES) {
        if (typeof target[type] !== 'function') continue;
        const original = target[type].bind(target);
        target[type] = function characterLifeToastBridge(message, title, ...rest) {
            if (!cl183IsOwnToast(title)) return original(message, title, ...rest);
            const config = cl183Notifications();
            if (config.mode === 'sillytavern') return original(message, title, ...rest);
            if (config.mode === 'character-life') return cl183ShowToast(type, String(message ?? ''), { title });
            return undefined;
        };
    }
}

function cl183SettingsHtml() {
    const cfg = cl183Notifications();
    const positionOptions = [
        ['top-left', 'Top left'], ['top-center', 'Top center'], ['top-right', 'Top right'],
        ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom center'], ['bottom-right', 'Bottom right'],
    ];
    return `<section id="character-life-qol-settings" class="cl-qol-settings-card">
        <header><div><small>INTERFACE</small><strong>Notifications & library tools</strong></div><span>v${CL183_VERSION}</span></header>
        <div class="cl-qol-settings-grid">
            <label><span>Notification style</span><select data-cl-notification-mode>
                <option value="character-life"${cfg.mode === 'character-life' ? ' selected' : ''}>Character Life UI</option>
                <option value="sillytavern"${cfg.mode === 'sillytavern' ? ' selected' : ''}>SillyTavern default</option>
                <option value="off"${cfg.mode === 'off' ? ' selected' : ''}>Off</option>
            </select></label>
            <label><span>Notification position</span><select data-cl-notification-position>
                ${positionOptions.map(([value, label]) => `<option value="${value}"${cfg.position === value ? ' selected' : ''}>${label}</option>`).join('')}
            </select></label>
        </div>
        <div class="cl-qol-settings-actions">
            <button type="button" class="menu_button" data-cl-preview-notification><i class="fa-solid fa-bell"></i> Preview notification</button>
        </div>
        <p>Character Life notifications stay separate from SillyTavern's global pop-ups. Bulk Move is available inside the NPC Library and can move many NPC records between Global, Character, and Chat at once.</p>
    </section>`;
}

function cl183EnsureSettings() {
    const content = document.querySelector('#character-life-settings .inline-drawer-content');
    if (!content) return false;
    let panel = document.getElementById('character-life-qol-settings');
    if (!panel) {
        const skillPanel = document.getElementById('character-life-skill-settings');
        if (skillPanel) skillPanel.insertAdjacentHTML('afterend', cl183SettingsHtml());
        else content.insertAdjacentHTML('beforeend', cl183SettingsHtml());
        panel = document.getElementById('character-life-qol-settings');
    }
    if (!panel || panel.dataset.cl183Bound === 'true') return Boolean(panel);
    panel.dataset.cl183Bound = 'true';
    panel.querySelector('[data-cl-notification-mode]')?.addEventListener('change', async event => {
        const value = event.currentTarget.value;
        if (!['character-life', 'sillytavern', 'off'].includes(value)) return;
        cl183Notifications().mode = value;
        await cl183PersistSettings();
        if (value === 'character-life') cl183ShowToast('success', 'Character Life notifications enabled.', { force: true });
    });
    panel.querySelector('[data-cl-notification-position]')?.addEventListener('change', async event => {
        const value = event.currentTarget.value;
        if (!CL183_POSITIONS.includes(value)) return;
        cl183Notifications().position = value;
        const host = document.getElementById('character-life-notifications');
        if (host) host.dataset.position = value;
        await cl183PersistSettings();
        cl183ShowToast('info', `Notification position: ${event.currentTarget.selectedOptions[0]?.textContent || value}`, { force: true });
    });
    panel.querySelector('[data-cl-preview-notification]')?.addEventListener('click', () => {
        cl183ShowToast('info', 'This is how Character Life updates will appear.', { force: true });
    });
    return true;
}

function cl183CurrentScope() {
    return document.querySelector('#character-life-overlay [data-scope].is-active')?.dataset.scope || 'chat';
}

function cl183ScopeAvailable(scope) {
    return scope === 'global' || cl183HasChat();
}

function cl183ScopeLabel(scope) {
    return scope === 'global' ? 'Global' : scope === 'character' ? 'Character' : 'Chat';
}

function cl183BulkBarHtml() {
    const source = cl183CurrentScope();
    const target = source === 'chat' ? 'character' : 'chat';
    const options = ['global', 'character', 'chat'].map(scope =>
        `<option value="${scope}"${scope === target ? ' selected' : ''}${scope === source || !cl183ScopeAvailable(scope) ? ' disabled' : ''}>${cl183ScopeLabel(scope)}</option>`
    ).join('');
    return `<div class="cl-bulk-bar" data-cl-bulk-bar>
        <div class="cl-bulk-summary"><strong data-cl-bulk-count>0 selected</strong><span>Choose multiple NPCs, then move them together.</span></div>
        <div class="cl-bulk-controls">
            <button type="button" data-cl-bulk-select-all><i class="fa-solid fa-check-double"></i><span>Select all</span></button>
            <label><span>Move to</span><select data-cl-bulk-target>${options}</select></label>
            <label><span>Name conflicts</span><select data-cl-bulk-conflict>
                <option value="skip">Keep destination</option>
                <option value="replace">Replace destination</option>
            </select></label>
            <button type="button" class="cl-bulk-move" data-cl-bulk-move disabled><i class="fa-solid fa-arrow-right-arrow-left"></i><span>Move selected</span></button>
            <button type="button" data-cl-bulk-cancel><i class="fa-solid fa-xmark"></i><span>Cancel</span></button>
        </div>
    </div>`;
}

function cl183EnsureBulkButton() {
    const overlay = document.getElementById('character-life-overlay');
    const toolbar = overlay?.querySelector('.cl-manager-toolbar');
    if (!toolbar) return false;
    let button = toolbar.querySelector('[data-cl-bulk-toggle]');
    if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'cl-bulk-toggle';
        button.dataset.clBulkToggle = '';
        button.innerHTML = '<i class="fa-solid fa-users-gear"></i><span>Bulk Move</span>';
        const newButton = toolbar.querySelector('[data-action="new"]');
        if (newButton) newButton.before(button);
        else toolbar.appendChild(button);
        button.addEventListener('click', () => {
            cl183BulkMode = !cl183BulkMode;
            cl183BulkSelected.clear();
            cl183RenderBulkUi();
        });
    }
    button.classList.toggle('is-active', cl183BulkMode);
    return true;
}

function cl183VisibleRows() {
    return [...document.querySelectorAll('#character-life-overlay .cl-npc-row[data-id]')];
}

function cl183DecorateRows() {
    for (const row of cl183VisibleRows()) {
        row.classList.toggle('cl-bulk-selectable', cl183BulkMode);
        row.classList.toggle('is-bulk-selected', cl183BulkSelected.has(row.dataset.id));
        let marker = row.querySelector('.cl-bulk-check');
        if (cl183BulkMode && !marker) {
            marker = document.createElement('span');
            marker.className = 'cl-bulk-check';
            marker.innerHTML = '<i class="fa-solid fa-check"></i>';
            row.prepend(marker);
        } else if (!cl183BulkMode && marker) marker.remove();
    }
}

function cl183UpdateBulkCount() {
    const bar = document.querySelector('#character-life-overlay [data-cl-bulk-bar]');
    const count = bar?.querySelector('[data-cl-bulk-count]');
    if (count) count.textContent = `${cl183BulkSelected.size} selected`;
    const move = bar?.querySelector('[data-cl-bulk-move]');
    if (move instanceof HTMLButtonElement) move.disabled = cl183BulkSelected.size === 0;
}

function cl183RenderBulkUi() {
    const overlay = document.getElementById('character-life-overlay');
    if (!overlay) return;
    cl183EnsureBulkButton();
    let bar = overlay.querySelector('[data-cl-bulk-bar]');
    if (cl183BulkMode && !bar) {
        const toolbar = overlay.querySelector('.cl-manager-toolbar');
        toolbar?.insertAdjacentHTML('afterend', cl183BulkBarHtml());
        bar = overlay.querySelector('[data-cl-bulk-bar]');
    } else if (!cl183BulkMode && bar) {
        bar.remove();
        bar = null;
    }
    overlay.classList.toggle('cl-bulk-mode', cl183BulkMode);
    cl183DecorateRows();
    cl183UpdateBulkCount();
}

function cl183ToggleRow(row) {
    const id = row?.dataset.id;
    if (!id) return;
    if (cl183BulkSelected.has(id)) cl183BulkSelected.delete(id);
    else cl183BulkSelected.add(id);
    row.classList.toggle('is-bulk-selected', cl183BulkSelected.has(id));
    cl183UpdateBulkCount();
}

function cl183SelectAllVisible() {
    const rows = cl183VisibleRows();
    const allSelected = rows.length > 0 && rows.every(row => cl183BulkSelected.has(row.dataset.id));
    for (const row of rows) {
        if (allSelected) cl183BulkSelected.delete(row.dataset.id);
        else cl183BulkSelected.add(row.dataset.id);
    }
    cl183DecorateRows();
    cl183UpdateBulkCount();
}

async function cl183BulkMove() {
    const overlay = document.getElementById('character-life-overlay');
    const source = cl183CurrentScope();
    const target = overlay?.querySelector('[data-cl-bulk-target]')?.value;
    const conflictMode = overlay?.querySelector('[data-cl-bulk-conflict]')?.value === 'replace' ? 'replace' : 'skip';
    if (!target || target === source || !cl183ScopeAvailable(target)) {
        cl183ShowToast('warning', 'Choose a different available destination.');
        return;
    }
    const sourceLibrary = [...cl183Library(source, true)];
    let targetLibrary = [...cl183Library(target, true)];
    const selected = sourceLibrary.filter(npc => cl183BulkSelected.has(npc?.id));
    if (!selected.length) return;

    const movedIds = new Set();
    let skipped = 0;
    for (const npc of selected) {
        const nameKey = String(npc?.name || '').trim().toLocaleLowerCase();
        const conflictIndex = targetLibrary.findIndex(entry => String(entry?.name || '').trim().toLocaleLowerCase() === nameKey);
        if (conflictIndex >= 0) {
            if (conflictMode === 'skip') {
                skipped += 1;
                continue;
            }
            targetLibrary.splice(conflictIndex, 1);
        }
        targetLibrary.push(npc);
        movedIds.add(npc.id);
    }
    if (!movedIds.size) {
        cl183ShowToast('warning', `${skipped} NPC${skipped === 1 ? '' : 's'} skipped because the destination already has the same name.`);
        return;
    }

    const nextSource = sourceLibrary.filter(npc => !movedIds.has(npc?.id));
    cl183SetLibrary(source, nextSource);
    cl183SetLibrary(target, targetLibrary);
    await cl183Persist([source, target]);

    cl183BulkSelected.clear();
    cl183BulkMode = false;
    globalThis.CharacterLifeNpcDirector?.refreshPrompt?.();
    globalThis.CharacterLifeNpcDirector?.refreshColors?.();
    const sourceTab = overlay?.querySelector(`[data-scope="${source}"]`);
    if (sourceTab instanceof HTMLElement) sourceTab.click();
    cl183QueueUi();

    const moved = movedIds.size;
    const suffix = skipped ? ` ${skipped} name conflict${skipped === 1 ? '' : 's'} skipped.` : '';
    cl183ShowToast('success', `Moved ${moved} NPC${moved === 1 ? '' : 's'} from ${cl183ScopeLabel(source)} to ${cl183ScopeLabel(target)}.${suffix}`);
}

function cl183BindBulkEvents() {
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const row = target.closest('#character-life-overlay .cl-npc-row[data-id]');
        if (cl183BulkMode && row) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            cl183ToggleRow(row);
            return;
        }
        if (target.closest('[data-cl-bulk-select-all]')) {
            event.preventDefault();
            cl183SelectAllVisible();
            return;
        }
        if (target.closest('[data-cl-bulk-cancel]')) {
            event.preventDefault();
            cl183BulkMode = false;
            cl183BulkSelected.clear();
            cl183RenderBulkUi();
            return;
        }
        if (target.closest('[data-cl-bulk-move]')) {
            event.preventDefault();
            void cl183BulkMove().catch(error => cl183ShowToast('error', error?.message || String(error)));
            return;
        }
        const scopeButton = target.closest('#character-life-overlay [data-scope]');
        if (scopeButton && cl183BulkMode) {
            cl183BulkSelected.clear();
            queueMicrotask(cl183RenderBulkUi);
        }
    }, true);
}

function cl183QueueUi() {
    if (cl183UiQueued) return;
    cl183UiQueued = true;
    queueMicrotask(() => {
        cl183UiQueued = false;
        cl183EnsureSettings();
        cl183EnsureBulkButton();
        cl183RenderBulkUi();
    });
}

function cl183Init() {
    cl183Root();
    cl183InstallToastrBridge();
    cl183BindBulkEvents();
    cl183QueueUi();
    cl183Observer = new MutationObserver(mutations => {
        if (mutations.some(item => item.addedNodes.length || item.removedNodes.length)) cl183QueueUi();
    });
    cl183Observer.observe(document.body, { childList: true, subtree: true });
    globalThis.CharacterLifeNotifications = Object.freeze({
        version: CL183_VERSION,
        show: (type, message, options) => cl183ShowToast(type, message, options),
        config: () => ({ ...cl183Notifications() }),
    });
    globalThis.CharacterLifeBulkMove = Object.freeze({
        version: CL183_VERSION,
        open: () => {
            cl183BulkMode = true;
            cl183BulkSelected.clear();
            cl183RenderBulkUi();
        },
        cancel: () => {
            cl183BulkMode = false;
            cl183BulkSelected.clear();
            cl183RenderBulkUi();
        },
    });
    console.info("[Character Life's] v1.8.3 native notifications + bulk NPC movement enabled.");
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cl183Init, { once: true });
else cl183Init();
