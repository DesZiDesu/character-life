/* global SillyTavern, toastr */

import './design-studio.js';

const VERSION = '1.7.2';
const MARKER = '/* CHARACTER-LIFE-INDEPENDENT-THEME:v1 */';
const ENHANCER_ID = 'character-life-design-creator-enhancer';
const RESET_STYLE_ID = 'character-life-independent-theme-reset-v171';
const UI_STYLE_ID = 'character-life-theme-studio-ui-v171';
const UNIFIED_COLOR_SETTING_ID = 'character-life-unified-colors';
let internalEditorWrite = false;
let syncQueued = false;

function notify(type, message) {
    if (typeof toastr !== 'undefined' && typeof toastr[type] === 'function') toastr[type](message, "Character Life's");
    else console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
}

function studio() { return document.getElementById('character-life-css-studio'); }
function creator() { return document.getElementById(ENHANCER_ID); }
function headerEditor() { return document.getElementById('character-life-header-css'); }
function thoughtEditor() { return document.getElementById('character-life-thought-css'); }
function dialogueEditor() { return document.getElementById('character-life-dialogue-css'); }
function hasMarker(value) { return String(value || '').includes(MARKER); }
function stripMarker(value) { return String(value || '').replace(MARKER, '').trimStart(); }

function settingsRoot() {
    try { return SillyTavern.getContext().extensionSettings?.character_life || null; }
    catch { return null; }
}

function unifiedColorsEnabled() {
    return settingsRoot()?.config?.unifiedNpcColors !== false;
}

function syncUnifiedNpcColors() {
    const enabled = unifiedColorsEnabled();
    const fallback = settingsRoot()?.config?.headerColor || '#c39a62';
    const speakerColors = new Map();

    document.querySelectorAll('.mes_text.character-life-rendered .cl-chat-header[data-cl-name]').forEach(block => {
        const name = String(block.dataset.clName || '').trim().toLocaleLowerCase();
        if (!name) return;
        const color = block.style.getPropertyValue('--cl-local-header').trim() || 'var(--cl-header-color)';
        speakerColors.set(name, color);
    });

    document.querySelectorAll('.mes_text.character-life-rendered').forEach(message => {
        message.dataset.clUnifiedColors = enabled ? 'true' : 'false';
        message.querySelectorAll('.cl-chat-block[data-cl-name]').forEach(block => {
            if (!enabled) {
                block.style.removeProperty('--cl-unified-color');
                return;
            }
            const name = String(block.dataset.clName || '').trim().toLocaleLowerCase();
            const ownHeader = block.classList.contains('cl-chat-header')
                ? block.style.getPropertyValue('--cl-local-header').trim()
                : '';
            block.style.setProperty('--cl-unified-color', speakerColors.get(name) || ownHeader || fallback);
        });
    });

    const preview = document.querySelector('.cl-design-preview');
    if (preview) {
        preview.dataset.clUnifiedColors = enabled ? 'true' : 'false';
        preview.querySelectorAll('.cl-chat-block').forEach(block => {
            if (enabled) block.style.setProperty('--cl-unified-color', 'var(--cl-header-color)');
            else block.style.removeProperty('--cl-unified-color');
        });
    }
}

function bindUnifiedColorSetting() {
    const input = document.getElementById(UNIFIED_COLOR_SETTING_ID);
    if (!(input instanceof HTMLInputElement)) return;
    input.checked = unifiedColorsEnabled();
    if (input.dataset.clBound === 'true') return;
    input.dataset.clBound = 'true';
    input.addEventListener('change', () => {
        const root = settingsRoot();
        if (root) {
            root.config ||= {};
            root.config.unifiedNpcColors = Boolean(input.checked);
            SillyTavern.getContext().saveSettingsDebounced();
        }
        syncUnifiedNpcColors();
    });
}

function savedPresetById(id) {
    const list = settingsRoot()?.customDesigns;
    return Array.isArray(list) ? list.find(item => item?.id === id) || null : null;
}

function isIndependentSavedPreset(id) {
    const preset = savedPresetById(id);
    return Boolean(preset && hasMarker(preset.headerCss));
}

function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
        syncQueued = false;
        syncIndependentDom();
    });
}

function syncIndependentDom() {
    const s = studio();
    const draftIndependent = Boolean(s?.dataset.clIndependentDraft === 'true' || hasMarker(headerEditor()?.value));
    const preview = document.querySelector('.cl-design-preview');
    if (preview) preview.toggleAttribute('data-cl-independent', draftIndependent && s?.dataset.preview === 'draft');

    document.querySelectorAll('.mes_text.character-life-rendered:not(.cl-design-preview)').forEach(element => {
        const presetId = element.dataset.clPreset || '';
        element.toggleAttribute('data-cl-independent', Boolean(presetId && isIndependentSavedPreset(presetId)));
    });
    syncUnifiedNpcColors();
}

function installResetCss() {
    if (document.getElementById(RESET_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = RESET_STYLE_ID;
    style.textContent = `
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-block,
.cl-design-preview[data-cl-independent] .cl-chat-block{background:transparent;border:0;border-radius:0;box-shadow:none;text-shadow:none;filter:none;backdrop-filter:none;outline:0;color:inherit;clip-path:none;mask:none;margin:0;padding:0;min-height:0}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-block::before,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-block::after,
.cl-design-preview[data-cl-independent] .cl-chat-block::before,
.cl-design-preview[data-cl-independent] .cl-chat-block::after{content:none;display:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-header,
.cl-design-preview[data-cl-independent] .cl-chat-header{display:flex;align-items:center;justify-content:center;width:100%;overflow:visible}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-header-core,
.cl-design-preview[data-cl-independent] .cl-chat-header-core{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:12px;width:100%;max-width:none;background:none;border:0;border-radius:0;box-shadow:none;padding:0;margin:0;transform:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-wing,
.cl-design-preview[data-cl-independent] .cl-chat-wing,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-portrait b,
.cl-design-preview[data-cl-independent] .cl-chat-portrait b{display:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-portrait,
.cl-design-preview[data-cl-independent] .cl-chat-portrait{position:relative;flex:none;width:var(--cl-portrait-size,76px);height:var(--cl-portrait-size,76px);aspect-ratio:1/1;background:none;border:0;border-radius:0;box-shadow:none;outline:0;clip-path:none;mask:none;overflow:hidden;transform:none;padding:0;margin:0}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-portrait::before,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-portrait::after,
.cl-design-preview[data-cl-independent] .cl-chat-portrait::before,
.cl-design-preview[data-cl-independent] .cl-chat-portrait::after{content:none;display:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-identity,
.cl-design-preview[data-cl-independent] .cl-chat-identity{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-width:0;max-width:none;background:none;border:0;padding:0;margin:0;text-align:left;transform:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-role,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-name,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-meta,
.cl-design-preview[data-cl-independent] .cl-chat-role,
.cl-design-preview[data-cl-independent] .cl-chat-name,
.cl-design-preview[data-cl-independent] .cl-chat-meta{background:none;border:0;box-shadow:none;text-shadow:none;transform:none;letter-spacing:normal;margin:0;padding:0}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-rule,
.cl-design-preview[data-cl-independent] .cl-chat-rule{display:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-meta,
.cl-design-preview[data-cl-independent] .cl-chat-meta{display:flex;flex-wrap:wrap;gap:6px;font-size:.78em;opacity:.78}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-thought,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-dialogue,
.cl-design-preview[data-cl-independent] .cl-chat-thought,
.cl-design-preview[data-cl-independent] .cl-chat-dialogue{display:block;width:100%;max-width:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-label,
.cl-design-preview[data-cl-independent] .cl-chat-label{display:flex;align-items:center;gap:6px;background:none;border:0;border-radius:0;box-shadow:none;padding:0;margin:0 0 6px;text-transform:none;letter-spacing:normal;font-style:normal}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-label>span,
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-label>i,
.cl-design-preview[data-cl-independent] .cl-chat-label>span,
.cl-design-preview[data-cl-independent] .cl-chat-label>i{display:none}
.mes_text.character-life-rendered[data-cl-independent] .cl-chat-content,
.cl-design-preview[data-cl-independent] .cl-chat-content{display:block;width:100%;max-width:none;background:none;border:0;border-radius:0;box-shadow:none;text-shadow:none;padding:0;margin:0;font-style:normal;font-weight:inherit;text-align:left;line-height:inherit;transform:none}
`;
    const custom = document.getElementById('character-life-custom-style');
    const preview = document.getElementById('character-life-custom-preview-style');
    if (custom?.parentNode) custom.parentNode.insertBefore(style, custom);
    else if (preview?.parentNode) preview.parentNode.insertBefore(style, preview);
    else document.head.append(style);
}

function installUiCss() {
    if (document.getElementById(UI_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = UI_STYLE_ID;
    style.textContent = `
#${ENHANCER_ID} .cl-independent-banner{display:flex;align-items:flex-start;gap:10px;margin:12px 0;padding:10px 12px;border:1px solid color-mix(in srgb,var(--cl-ui-accent,#c39a62) 36%,transparent);border-radius:11px;background:color-mix(in srgb,var(--cl-ui-accent,#c39a62) 8%,transparent)}
#${ENHANCER_ID} .cl-independent-banner i{margin-top:2px;color:var(--cl-ui-accent,#c39a62)}
#${ENHANCER_ID} .cl-independent-banner strong,#${ENHANCER_ID} .cl-independent-banner span{display:block}#${ENHANCER_ID} .cl-independent-banner span{font-size:.82em;opacity:.76;margin-top:2px;line-height:1.45}
#${ENHANCER_ID} .cl-easy-grid label.cl-color-control{grid-template-columns:minmax(0,1fr) auto!important;align-items:center;min-height:48px}
#${ENHANCER_ID} .cl-easy-grid input[type="color"]{-webkit-appearance:none;appearance:none;width:44px!important;height:44px!important;min-width:44px!important;max-width:44px!important;aspect-ratio:1/1;padding:0!important;border:2px solid rgba(255,255,255,.72)!important;border-radius:50%!important;overflow:hidden;background:transparent;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 2px 8px rgba(0,0,0,.24);cursor:pointer}
#${ENHANCER_ID} .cl-easy-grid input[type="color"]::-webkit-color-swatch-wrapper{padding:2px;border-radius:50%}
#${ENHANCER_ID} .cl-easy-grid input[type="color"]::-webkit-color-swatch{border:0;border-radius:50%}
#${ENHANCER_ID} .cl-easy-grid input[type="color"]::-moz-color-swatch{border:0;border-radius:50%}
#${ENHANCER_ID} .cl-easy-builder .menu_button{font-size:.84em;line-height:1.25;padding:7px 10px;min-height:36px;white-space:normal}
#${ENHANCER_ID} .cl-ai-generate{font-size:.86em;line-height:1.3}
#${ENHANCER_ID} .cl-theme-version{font-size:.72em;opacity:.68;margin-left:5px}
.mes_text.character-life-rendered[data-cl-unified-colors="true"] .cl-chat-header{--cl-local-header:var(--cl-unified-color)!important}
.mes_text.character-life-rendered[data-cl-unified-colors="true"] .cl-chat-thought{--cl-local-thought:var(--cl-unified-color)!important}
.mes_text.character-life-rendered[data-cl-unified-colors="true"] .cl-chat-dialogue{--cl-local-dialogue:var(--cl-unified-color)!important}
.mes_text.character-life-rendered[data-cl-design="arcane-regalia"]:not([data-cl-custom="true"]) .cl-chat-header-core{background:transparent!important;border:0!important;box-shadow:none!important;padding:var(--cl-chat-header-pad) 0!important}
.mes_text.character-life-rendered[data-cl-design="arcane-regalia"]:not([data-cl-custom="true"]) .cl-chat-header-core::before{content:none!important;display:none!important}
@media(max-width:620px){#${ENHANCER_ID}{padding:10px!important;margin:10px 0!important}#${ENHANCER_ID} .cl-design-creator-head{display:block}#${ENHANCER_ID} .cl-mode-switch{margin-top:10px;width:100%}#${ENHANCER_ID} .cl-mode-switch button{flex:1}#${ENHANCER_ID} .cl-easy-builder>header{align-items:flex-start}#${ENHANCER_ID} .cl-easy-builder>header>div:last-child{width:100%;display:grid;grid-template-columns:1fr 1fr}#${ENHANCER_ID} .cl-easy-grid label{grid-template-columns:minmax(0,1fr) minmax(108px,.85fr);gap:10px}#${ENHANCER_ID} .cl-easy-grid label.cl-color-control{grid-template-columns:minmax(0,1fr) 48px!important}#${ENHANCER_ID} .cl-ai-design-actions{display:block}#${ENHANCER_ID} .cl-ai-design-actions .menu_button{width:100%;margin-bottom:7px}}
`;
    document.head.append(style);
}

function setIndependentFlag(value) {
    const s = studio();
    if (!s) return;
    s.dataset.clIndependentDraft = value ? 'true' : 'false';
    scheduleSync();
}

function addMarkerToHeader({ dispatch = true } = {}) {
    const editor = headerEditor();
    if (!editor || hasMarker(editor.value)) return;
    internalEditorWrite = true;
    editor.value = `${MARKER}\n${editor.value || ''}`.trimEnd();
    internalEditorWrite = false;
    if (dispatch) editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function enforceEasyIndependentRules() {
    const showWings = document.querySelector('[data-cl-easy="showWings"]')?.checked;
    const editor = headerEditor();
    if (!editor) return;
    const rule = `.cl-chat-wing { display: ${showWings ? 'flex' : 'none'}; }`;
    let value = stripMarker(editor.value).replace(/\n?\.cl-chat-wing\s*\{\s*display:\s*(?:flex|none);?\s*\}\s*$/i, '').trimEnd();
    value = `${MARKER}\n${value}${value ? '\n' : ''}${rule}`;
    if (editor.value === value) return;
    internalEditorWrite = true;
    editor.value = value;
    internalEditorWrite = false;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function startIndependentDraft() {
    const s = studio();
    if (!s) return;
    const base = document.getElementById('character-life-preset-base');
    if (base) base.value = 'clean';
    setIndependentFlag(true);
    internalEditorWrite = true;
    if (headerEditor()) headerEditor().value = MARKER;
    if (thoughtEditor()) thoughtEditor().value = '';
    if (dialogueEditor()) dialogueEditor().value = '';
    internalEditorWrite = false;
    headerEditor()?.dispatchEvent(new Event('input', { bubbles: true }));
    const status = document.getElementById('character-life-css-status');
    if (status) status.textContent = 'Independent Blank Canvas ready. Build a completely new Header, Monologue, and Dialogue theme.';
    scheduleSync();
}

function detectLoadedTheme() {
    const independent = hasMarker(headerEditor()?.value);
    setIndependentFlag(independent);
}

function parseAiCss(raw) {
    let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    const data = JSON.parse(text);
    const result = {
        headerCss: typeof data.headerCss === 'string' ? data.headerCss : '',
        thoughtCss: typeof data.thoughtCss === 'string' ? data.thoughtCss : (typeof data.monologueCss === 'string' ? data.monologueCss : ''),
        dialogueCss: typeof data.dialogueCss === 'string' ? data.dialogueCss : '',
    };
    if (!result.headerCss && !result.thoughtCss && !result.dialogueCss) throw new Error('The AI did not return usable theme CSS.');
    return result;
}

async function generateIndependentWithAi(button) {
    const request = document.getElementById('character-life-ai-style-request')?.value?.trim();
    if (!request) throw new Error('Describe the theme you want first.');
    const generator = SillyTavern?.getContext?.().generateQuietPrompt;
    if (typeof generator !== 'function') throw new Error('This SillyTavern build does not expose quiet AI generation to extensions.');

    setIndependentFlag(true);
    const current = {
        headerCss: stripMarker(headerEditor()?.value || ''),
        thoughtCss: thoughtEditor()?.value || '',
        dialogueCss: dialogueEditor()?.value || '',
    };
    const prompt = `CHARACTER LIFE INDEPENDENT THEME ASSISTANT\nCreate a complete visual theme from a neutral blank canvas. There is NO Chronicle, Imperial, Clean, Manga, or other built-in visual theme underneath the result. The stable Character Life DOM classes remain only as semantic hooks for portraits, names, metadata, monologue, and dialogue.\n\nUSER THEME REQUEST:\n${request}\n\nCURRENT OPTIONAL CSS:\nHEADER:\n${current.headerCss || '(empty)'}\nMONOLOGUE:\n${current.thoughtCss || '(empty)'}\nDIALOGUE:\n${current.dialogueCss || '(empty)'}\n\nReturn ONLY strict one-line JSON with exactly these string keys: {"headerCss":"...","thoughtCss":"...","dialogueCss":"..."}. Escape line breaks inside strings as \\n.\nRules:\n- Design all three components as a coherent new theme from scratch. Do not assume any built-in Character Life decoration exists.\n- Use only declarations or flat selector rules. When mixing outer declarations with child rules, put the outer declarations inside an & { ... } rule.\n- Never use @import, @media, @supports, @keyframes, @layer, @container, :global(), HTML, JavaScript, markdown fences, or nested CSS.\n- Allowed hooks include .cl-chat-header-core, .cl-chat-portrait, .cl-chat-identity, .cl-chat-name, .cl-chat-role, .cl-chat-meta, .cl-chat-wing, .cl-chat-rule, .cl-chat-label, and .cl-chat-content.\n- Use & at most once and only at the beginning of a selector.\n- Keep the design responsive and touch-friendly. Avoid fixed widths wider than 100%.\n- Make the requested style visually distinct, not a minor recolor.\n- Keep each CSS string under 9000 characters.`;

    const old = button.innerHTML;
    const status = document.getElementById('character-life-ai-style-status');
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating independent theme…';
    if (status) status.textContent = 'Using your active SillyTavern model on a blank canvas…';
    try {
        const result = parseAiCss(await generator(prompt));
        internalEditorWrite = true;
        headerEditor().value = `${MARKER}\n${result.headerCss}`.trimEnd();
        thoughtEditor().value = result.thoughtCss;
        dialogueEditor().value = result.dialogueCss;
        internalEditorWrite = false;
        headerEditor().dispatchEvent(new Event('input', { bubbles: true }));
        thoughtEditor().dispatchEvent(new Event('input', { bubbles: true }));
        dialogueEditor().dispatchEvent(new Event('input', { bubbles: true }));
        creator()?.querySelector('[data-cl-mode="advanced"]')?.click();
        if (status) status.textContent = 'Independent theme generated. All three code editors and the live preview are updated.';
        document.querySelector('.cl-design-preview-shell')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
        button.disabled = false;
        button.innerHTML = old;
        scheduleSync();
    }
}

function exportIndependentPreset(event) {
    if (!hasMarker(headerEditor()?.value)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    const s = studio();
    const existing = savedPresetById(s?.dataset.presetId || '');
    const now = new Date().toISOString();
    const preset = {
        id: existing?.id || `design-${Date.now().toString(36)}`,
        name: document.getElementById('character-life-preset-name')?.value?.trim() || 'Independent theme',
        base: 'clean',
        headerCss: headerEditor()?.value || MARKER,
        thoughtCss: thoughtEditor()?.value || '',
        dialogueCss: dialogueEditor()?.value || '',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };
    const file = { format: 'character-life-design', version: 1, extensionVersion: VERSION, exportedAt: now, preset };
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `character-life-independent-theme-${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
}

function updateUiCopy() {
    const badge = document.querySelector('#character-life-settings .inline-drawer-header small');
    if (badge) badge.textContent = `v${VERSION}`;
    const s = studio();
    if (s) {
        const summary = s.querySelector(':scope > summary');
        if (summary) summary.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> Independent Theme Creator';
        const intro = s.querySelector(':scope > p');
        if (intro) intro.textContent = 'Create a complete Header, Monologue, and Dialogue theme from a neutral blank canvas. Built-in themes are not used as the visual foundation for new v1.7.2 themes.';
        const base = document.getElementById('character-life-preset-base');
        const baseLabel = base?.closest('label');
        if (baseLabel) { baseLabel.hidden = true; baseLabel.setAttribute('aria-hidden', 'true'); }
    }

    const c = creator();
    if (!c) return;
    const title = c.querySelector('.cl-design-creator-head strong');
    const description = c.querySelector('.cl-design-creator-head p');
    if (title) title.innerHTML = `Create a completely new Character Life theme <span class="cl-theme-version">v${VERSION}</span>`;
    if (description) description.textContent = 'Easy, Advanced, and AI modes build on an independent blank canvas. The original Character Life DOM is kept only so portraits, NPC data, and speaker parsing continue to work.';
    if (!c.querySelector('.cl-independent-banner')) {
        c.querySelector('.cl-design-creator-head')?.insertAdjacentHTML('afterend', '<div class="cl-independent-banner"><i class="fa-solid fa-layer-group"></i><div><strong>Independent Blank Canvas</strong><span>New themes neutralize the old visual styling first, then your Header, Monologue, and Dialogue CSS becomes the complete visual design.</span></div></div>');
    }
    const guideArticles = c.querySelectorAll('.cl-guide-grid article');
    if (guideArticles[0]) guideArticles[0].querySelector('span').innerHTML = 'Press <em>New</em>. Character Life starts an independent blank theme automatically—no built-in theme is used as the visual base.';
    if (guideArticles[1]) guideArticles[1].querySelector('span').innerHTML = '<em>Easy</em> builds the theme visually. <em>Advanced</em> lets you write all three CSS sections directly.';
    if (guideArticles[2]) guideArticles[2].querySelector('span').innerHTML = 'Desktop and Mobile previews show the blank-canvas result live while you edit or generate.';
    c.querySelectorAll('.cl-easy-grid input[type="color"]').forEach(input => input.closest('label')?.classList.add('cl-color-control'));
}

function bindV171() {
    const s = studio();
    const c = creator();
    if (!s || !c || s.dataset.clV171Bound === 'true') return false;
    s.dataset.clV171Bound = 'true';
    installResetCss();
    installUiCss();
    updateUiCopy();
    bindUnifiedColorSetting();

    document.getElementById('character-life-preset-new')?.addEventListener('click', () => queueMicrotask(startIndependentDraft));
    document.getElementById('character-life-preset-save')?.addEventListener('click', () => queueMicrotask(detectLoadedTheme));
    document.getElementById('character-life-design')?.addEventListener('change', () => queueMicrotask(detectLoadedTheme));
    document.getElementById('character-life-preset-import')?.addEventListener('change', () => setTimeout(detectLoadedTheme, 50));
    document.getElementById('character-life-preset-export')?.addEventListener('click', exportIndependentPreset, true);

    c.addEventListener('input', event => {
        if (internalEditorWrite) return;
        if (event.target.matches('[data-cl-easy]')) {
            setIndependentFlag(true);
            queueMicrotask(() => { addMarkerToHeader(); enforceEasyIndependentRules(); });
            return;
        }
        if (event.target.matches('#character-life-header-css,#character-life-thought-css,#character-life-dialogue-css')) {
            if (s.dataset.clIndependentDraft === 'true' && event.target === headerEditor() && !hasMarker(event.target.value)) queueMicrotask(() => addMarkerToHeader());
            scheduleSync();
        }
    });
    c.addEventListener('change', event => {
        if (event.target.matches('[data-cl-easy]')) {
            setIndependentFlag(true);
            queueMicrotask(() => { addMarkerToHeader(); enforceEasyIndependentRules(); });
        }
    });

    const aiButton = c.querySelector('.cl-ai-generate');
    aiButton?.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        void generateIndependentWithAi(aiButton).catch(error => notify('error', error.message));
    }, true);

    const actions = s.querySelector('.cl-css-actions');
    if (actions && !actions.querySelector('[data-cl-independent-convert]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu_button';
        button.dataset.clIndependentConvert = 'true';
        button.innerHTML = '<i class="fa-solid fa-layer-group"></i> Make independent';
        button.title = 'Convert the current draft/preset to the independent blank-canvas renderer.';
        button.addEventListener('click', () => {
            setIndependentFlag(true);
            addMarkerToHeader();
            const base = document.getElementById('character-life-preset-base');
            if (base) base.value = 'clean';
            notify('success', 'Current theme is now independent. Save the preset to keep the change.');
        });
        actions.append(button);
    }

    detectLoadedTheme();
    scheduleSync();
    return true;
}

function observe() {
    if (bindV171()) {
        const chat = document.getElementById('chat');
        const target = chat || document.body;
        const observer = new MutationObserver(scheduleSync);
        observer.observe(target, { childList: true, subtree: true });
        return;
    }
    const observer = new MutationObserver(() => {
        if (bindV171()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
else observe();

console.info(`[Character Life's] Independent Theme Creator v${VERSION} loaded.`);
