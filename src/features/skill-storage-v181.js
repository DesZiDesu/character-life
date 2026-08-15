/* global SillyTavern, toastr */

// Character Life v1.8.1 — Skill Storage presentation + settings integration.
// Keeps the existing skill persistence/tracking engine, but moves configuration
// into the Extensions drawer and gives Skill Storage its own Wand-menu entry.

const VERSION = '1.8.1';
const SETTINGS_KEY = 'character_life';
const CHAT_ENABLED_KEY = 'character_life_skill_indicators_enabled';
const DESIGNS = [
    { id: 'arcane-dossier', name: 'Arcane Dossier' },
    { id: 'tactical-vector', name: 'Tactical Vector' },
    { id: 'manga-panel', name: 'Manga Panel' },
    { id: 'minimal-crest', name: 'Minimal Crest' },
];

let menuObserver = null;
let settingsObserver = null;
let syncQueued = false;

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
    const skillSystem = root.skillSystem ||= {
        version: 1,
        config: { design: 'arcane-dossier', autoTrack: true, showIndicators: true, showWand: true },
        globalSkills: [],
        characterSkills: {},
    };
    skillSystem.config ||= {};
    if (!DESIGNS.some(item => item.id === skillSystem.config.design)) skillSystem.config.design = 'arcane-dossier';
    if (typeof skillSystem.config.autoTrack !== 'boolean') skillSystem.config.autoTrack = true;
    if (typeof skillSystem.config.showIndicators !== 'boolean') skillSystem.config.showIndicators = true;
    if (typeof skillSystem.config.showWand !== 'boolean') skillSystem.config.showWand = true;
    return root;
}

function skillConfig() {
    return rootSettings()?.skillSystem?.config || { design: 'arcane-dossier', autoTrack: true, showIndicators: true, showWand: true };
}

function hasChat() {
    return Boolean(ctx()?.getCurrentChatId?.());
}

function chatEnabled() {
    if (!hasChat()) return false;
    const api = globalThis.CharacterLifeSkillToggle;
    if (typeof api?.enabled === 'function') return Boolean(api.enabled());
    const value = ctx()?.chatMetadata?.[CHAT_ENABLED_KEY];
    return typeof value === 'boolean' ? value : false;
}

async function persistSettings() {
    const saver = ctx()?.saveSettingsDebounced;
    if (typeof saver !== 'function') return;
    const queued = saver();
    if (typeof saver.flush === 'function') {
        const flushed = saver.flush();
        if (flushed && typeof flushed.then === 'function') await flushed;
    } else if (queued && typeof queued.then === 'function') {
        await queued;
    }
}

function patchPublicVersions() {
    const skills = globalThis.CharacterLifeSkills;
    if (skills && skills.version !== VERSION && !skills.__v181Wrapped) {
        globalThis.CharacterLifeSkills = Object.freeze({
            ...skills,
            version: VERSION,
            __v181Wrapped: true,
            open: (...args) => {
                const result = skills.open?.(...args);
                queueMicrotask(() => patchSkillStorageOverlay());
                return result;
            },
        });
    }
    const toggle = globalThis.CharacterLifeSkillToggle;
    if (toggle && toggle.version !== VERSION && !toggle.__v181Wrapped) {
        globalThis.CharacterLifeSkillToggle = Object.freeze({ ...toggle, version: VERSION, __v181Wrapped: true });
    }
}

function setDisplayedVersion() {
    const badge = document.querySelector('#character-life-settings .inline-drawer-header small');
    if (badge) badge.textContent = `v${VERSION}`;
}

function previewHtml(design) {
    return `<div class="cl-skill-settings-preview-card">
        <span class="cl-skill-preview-label">LIVE PREVIEW · ${DESIGNS.find(item => item.id === design)?.name || 'Skill Indicator'}</span>
        <div class="cl-skill-preview-stage">
            <span class="cl-skill-indication" data-cl-skill-design="${design}" style="--cl-skill-accent:var(--cl-header-color,#c39a62)">
                <span class="cl-skill-icon-frame"><span class="cl-skill-icon-fallback">A</span></span>
                <span class="cl-skill-copy"><span class="cl-skill-eyebrow"><b>Preview Character</b><em>Technique</em></span>
                <strong>Astral Step</strong><span class="cl-skill-rule"></span><small>A compact preview of the card that appears inside chat.</small></span>
                <span class="cl-skill-rank"><small>RANK</small><b>A</b></span>
            </span>
        </div>
    </div>`;
}

function settingsPanelHtml() {
    const cfg = skillConfig();
    return `<section id="character-life-skill-settings" class="cl-skill-settings-card">
        <header class="cl-skill-settings-heading">
            <div><small>SKILL INDICATORS</small><strong>Skill Storage</strong></div>
            <span>v${VERSION}</span>
        </header>
        <p>Skill tracking settings live here. The Wand menu now opens Skill Storage as its own interface instead of placing skill controls inside the NPC Library.</p>
        <div class="cl-skill-settings-actions">
            <button id="character-life-open-skill-storage" class="menu_button" type="button"><i class="fa-solid fa-wand-sparkles"></i> Open Skill Storage</button>
        </div>
        <label class="checkbox_label cl-skill-settings-master" for="character-life-skill-enabled">
            <input id="character-life-skill-enabled" type="checkbox">
            <span><b>Enable Skill Indicators for this chat</b><small id="character-life-skill-chat-status">Open a chat to configure this option.</small></span>
        </label>
        <div class="cl-skill-settings-grid">
            <label><span>Skill indication design</span><select id="character-life-skill-design">${DESIGNS.map(item => `<option value="${item.id}"${item.id === cfg.design ? ' selected' : ''}>${item.name}</option>`).join('')}</select></label>
            <label class="checkbox_label"><input id="character-life-skill-autotrack" type="checkbox"><span>AI auto-track used / learned skills</span></label>
            <label class="checkbox_label"><input id="character-life-skill-show" type="checkbox"><span>Show skill indication cards in chat</span></label>
            <label class="checkbox_label"><input id="character-life-skill-wand" type="checkbox"><span>Show Skill Storage in the Wand menu</span></label>
        </div>
        <div id="character-life-skill-live-preview">${previewHtml(cfg.design)}</div>
    </section>`;
}

function syncSettingsUi() {
    setDisplayedVersion();
    const panel = document.getElementById('character-life-skill-settings');
    if (!panel) return;
    const cfg = skillConfig();
    const master = document.getElementById('character-life-skill-enabled');
    if (master instanceof HTMLInputElement) {
        master.disabled = !hasChat();
        master.checked = chatEnabled();
    }
    const status = document.getElementById('character-life-skill-chat-status');
    if (status) status.textContent = hasChat()
        ? (chatEnabled() ? 'Enabled for the current chat.' : 'Disabled for the current chat.')
        : 'Open a chat to configure this option.';
    const design = document.getElementById('character-life-skill-design');
    if (design instanceof HTMLSelectElement) design.value = cfg.design;
    const auto = document.getElementById('character-life-skill-autotrack');
    if (auto instanceof HTMLInputElement) auto.checked = cfg.autoTrack !== false;
    const show = document.getElementById('character-life-skill-show');
    if (show instanceof HTMLInputElement) show.checked = cfg.showIndicators !== false;
    const wand = document.getElementById('character-life-skill-wand');
    if (wand instanceof HTMLInputElement) wand.checked = cfg.showWand !== false;
    renderSettingsPreview();
}

function renderSettingsPreview() {
    const host = document.getElementById('character-life-skill-live-preview');
    if (!host) return;
    host.innerHTML = previewHtml(skillConfig().design);
}

function forwardLegacySetting(selector, value) {
    const control = document.querySelector(`#character-life-skills-overlay ${selector}`);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return false;
    if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

async function setSkillConfig(key, value) {
    const cfg = skillConfig();
    cfg[key] = value;
    const selectors = {
        design: '[data-cl-skill-design]',
        autoTrack: '[data-cl-skill-autotrack]',
        showIndicators: '[data-cl-skill-show]',
    };
    if (!selectors[key] || !forwardLegacySetting(selectors[key], value)) await persistSettings();
    if (key === 'showWand') syncSkillStorageLauncher();
    if (key === 'design') renderSettingsPreview();
}

function bindSettingsPanel(panel) {
    if (panel.dataset.clBound === 'true') return;
    panel.dataset.clBound = 'true';

    document.getElementById('character-life-open-skill-storage')?.addEventListener('click', () => openSkillStorage());
    document.getElementById('character-life-skill-enabled')?.addEventListener('change', async event => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        try {
            const api = globalThis.CharacterLifeSkillToggle;
            if (typeof api?.setEnabled !== 'function') throw new Error('Skill Indicator controller is not ready yet. Close and reopen the Extensions drawer, then try again.');
            await api.setEnabled(input.checked);
        } catch (error) {
            input.checked = chatEnabled();
            notify('error', error.message);
        }
        syncSettingsUi();
    });
    document.getElementById('character-life-skill-design')?.addEventListener('change', event => {
        const value = event.currentTarget?.value;
        if (DESIGNS.some(item => item.id === value)) void setSkillConfig('design', value);
    });
    document.getElementById('character-life-skill-autotrack')?.addEventListener('change', event => {
        void setSkillConfig('autoTrack', Boolean(event.currentTarget?.checked));
    });
    document.getElementById('character-life-skill-show')?.addEventListener('change', event => {
        void setSkillConfig('showIndicators', Boolean(event.currentTarget?.checked));
    });
    document.getElementById('character-life-skill-wand')?.addEventListener('change', event => {
        void setSkillConfig('showWand', Boolean(event.currentTarget?.checked));
    });
}

function ensureSettingsPanel() {
    setDisplayedVersion();
    const content = document.querySelector('#character-life-settings .inline-drawer-content');
    if (!content) return false;
    let panel = document.getElementById('character-life-skill-settings');
    if (!panel) {
        const actions = content.querySelector('.cl-settings-actions');
        if (actions) actions.insertAdjacentHTML('afterend', settingsPanelHtml());
        else content.insertAdjacentHTML('afterbegin', settingsPanelHtml());
        panel = document.getElementById('character-life-skill-settings');
    }
    if (panel) bindSettingsPanel(panel);
    syncSettingsUi();
    return Boolean(panel);
}

function removeEmbeddedSkillButton() {
    document.querySelectorAll('#character-life-overlay [data-cl-open-skills]').forEach(button => button.remove());
}

function patchSkillStorageOverlay() {
    const overlay = document.getElementById('character-life-skills-overlay');
    if (!overlay) return false;
    const manager = overlay.querySelector('.cl-skills-manager');
    if (!manager) return false;
    manager.classList.add('cl-skill-storage-manager');
    const title = manager.querySelector('#cl-skills-title');
    if (title) title.textContent = 'Skill Storage';
    const kicker = manager.querySelector('.cl-skills-header small');
    if (kicker) kicker.textContent = 'CHARACTER LIFE';
    const footer = manager.querySelector(':scope > footer');
    if (footer) {
        footer.classList.add('cl-skill-legacy-settings');
        footer.setAttribute('aria-hidden', 'true');
    }
    if (!manager.querySelector('[data-cl-skill-mobile-back]')) {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'cl-skill-mobile-back';
        back.dataset.clSkillMobileBack = '';
        back.setAttribute('aria-label', 'Back to skill list');
        back.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        manager.querySelector('.cl-skills-header')?.prepend(back);
        back.addEventListener('click', () => {
            const activeScope = manager.querySelector('[data-cl-skill-scope].is-active');
            if (activeScope instanceof HTMLElement) activeScope.click();
            manager.dataset.mobileView = 'list';
        });
    }
    updateMobileView(manager);
    return true;
}

function updateMobileView(manager = document.querySelector('#character-life-skills-overlay .cl-skills-manager')) {
    if (!manager) return;
    const editing = Boolean(manager.querySelector('[data-cl-skill-form]'));
    const selected = Boolean(manager.querySelector('.cl-skill-row.is-active'));
    manager.dataset.mobileView = editing ? 'editor' : selected ? 'detail' : 'list';
}

function openSkillStorage() {
    patchPublicVersions();
    const api = globalThis.CharacterLifeSkills;
    if (typeof api?.open !== 'function') {
        notify('warning', 'Skill Storage is still loading. Try again in a moment.');
        return;
    }
    api.open();
    queueMicrotask(() => {
        patchSkillStorageOverlay();
        const manager = document.querySelector('#character-life-skills-overlay .cl-skills-manager');
        if (manager) manager.dataset.mobileView = 'list';
    });
}

function createSkillStorageLauncher() {
    if (document.getElementById('character-life-skill-storage-launcher')) return true;
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;
    const launcher = document.createElement('div');
    launcher.id = 'character-life-skill-storage-launcher';
    launcher.className = 'list-group-item flex-container flexGap5 interactable';
    launcher.tabIndex = 0;
    launcher.setAttribute('role', 'button');
    launcher.title = 'Open Character Life Skill Storage';
    launcher.innerHTML = '<i class="fa-solid fa-wand-sparkles"></i><span>Skill Storage</span>';
    const activate = event => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openSkillStorage();
    };
    launcher.addEventListener('click', activate);
    launcher.addEventListener('keydown', activate);
    menu.appendChild(launcher);
    syncSkillStorageLauncher();
    return true;
}

function syncSkillStorageLauncher() {
    const launcher = document.getElementById('character-life-skill-storage-launcher');
    if (launcher) launcher.hidden = skillConfig().showWand === false;
}

function ensureSkillStorageLauncher() {
    if (createSkillStorageLauncher() || menuObserver) return;
    menuObserver = new MutationObserver(() => {
        if (createSkillStorageLauncher()) {
            menuObserver.disconnect();
            menuObserver = null;
        }
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });
}

function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
        syncQueued = false;
        patchPublicVersions();
        removeEmbeddedSkillButton();
        patchSkillStorageOverlay();
        ensureSettingsPanel();
        ensureSkillStorageLauncher();
        syncSkillStorageLauncher();
    });
}

function bindEvents() {
    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('#character-life-skills-overlay')) queueMicrotask(() => updateMobileView());
        if (target?.closest('#character-life-overlay')) queueMicrotask(removeEmbeddedSkillButton);
    }, true);
    document.addEventListener('submit', event => {
        if (event.target instanceof Element && event.target.closest('#character-life-skills-overlay')) queueMicrotask(() => updateMobileView());
    }, true);
    globalThis.addEventListener('character-life:skills-ready', queueSync);
    globalThis.addEventListener('character-life:skill-system-toggle', () => syncSettingsUi());

    const context = ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (source?.on) {
        for (const key of ['CHAT_CHANGED', 'CHAT_LOADED']) {
            const type = types[key];
            if (type) source.on(type, () => queueMicrotask(syncSettingsUi));
        }
    }
}

function observeSettingsDrawer() {
    if (ensureSettingsPanel() || settingsObserver) return;
    settingsObserver = new MutationObserver(() => {
        if (ensureSettingsPanel()) {
            settingsObserver.disconnect();
            settingsObserver = null;
        }
    });
    settingsObserver.observe(document.body, { childList: true, subtree: true });
}

function init() {
    rootSettings();
    bindEvents();
    patchPublicVersions();
    patchSkillStorageOverlay();
    removeEmbeddedSkillButton();
    ensureSkillStorageLauncher();
    observeSettingsDrawer();
    queueSync();
    document.documentElement.setAttribute('data-character-life-version', VERSION);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
