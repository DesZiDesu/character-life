/* global SillyTavern, toastr */

import './index.js';

const ENHANCER_ID = 'character-life-design-creator-enhancer';
const STYLE_ID = 'character-life-design-creator-style';
const MOBILE_PREVIEW_WIDTH = '390px';

const DEFAULT_EASY = Object.freeze({
    headerBackground: '#171717', thoughtBackground: '#20181d', dialogueBackground: '#171b22',
    borderColor: '#6f6f6f', textColor: '#f2f2f2', accentColor: '#c39a62', radius: 14,
    borderWidth: 1, padding: 14, shadow: 18, headerDirection: 'row', headerAlign: 'center',
    nameSize: 118, nameWeight: '700', nameTransform: 'none', contentAlign: 'left',
    contentLineHeight: 1.65, contentMaxWidth: 100, portraitScale: 100, portraitRadius: 14,
    showMeta: true, showRole: true, showWings: true, showThoughtLabel: true,
    showDialogueLabel: true, thoughtItalic: false, glass: false,
});

function notify(type, message) {
    if (typeof toastr !== 'undefined' && typeof toastr[type] === 'function') toastr[type](message, "Character Life's");
    else console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
}

function hexToRgba(hex, alpha = 1) {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex || ''));
    if (!match) return `rgba(0,0,0,${alpha})`;
    return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

function textArea(id) { return document.getElementById(id); }
function dispatchInput(element) { element?.dispatchEvent(new Event('input', { bubbles: true })); }

function setGeneratedCss({ headerCss = '', thoughtCss = '', dialogueCss = '' }, source = 'Generated') {
    const header = textArea('character-life-header-css');
    const thought = textArea('character-life-thought-css');
    const dialogue = textArea('character-life-dialogue-css');
    if (!header || !thought || !dialogue) throw new Error('Character Life CSS editors are not available yet.');
    header.value = String(headerCss || '').slice(0, 12000);
    thought.value = String(thoughtCss || '').slice(0, 12000);
    dialogue.value = String(dialogueCss || '').slice(0, 12000);
    dispatchInput(header); dispatchInput(thought); dispatchInput(dialogue);
    const status = document.getElementById('character-life-css-status');
    if (status) status.textContent = `${source} CSS inserted. Review the live preview, then Save & use preset.`;
}

function easyValue(name, fallback) {
    const element = document.querySelector(`[data-cl-easy="${CSS.escape(name)}"]`);
    if (!element) return fallback;
    if (element.type === 'checkbox') return element.checked;
    if (element.type === 'range' || element.type === 'number') return Number(element.value);
    return element.value;
}

function updateEasyOutputs(root = document) {
    root.querySelectorAll('[data-cl-easy-output]').forEach(output => {
        const value = easyValue(output.dataset.clEasyOutput, '');
        output.textContent = `${value}${output.dataset.suffix || ''}`;
    });
}

function easyCss() {
    const v = (key) => easyValue(key, DEFAULT_EASY[key]);
    const shadow = v('shadow');
    const shadowValue = shadow > 0 ? `0 ${Math.max(2, Math.round(shadow / 6))}px ${shadow}px rgba(0,0,0,.32)` : 'none';
    const glassCss = v('glass') ? 'backdrop-filter: blur(12px);' : '';
    const alpha = v('glass') ? { header: .78, thought: .72, dialogue: .72 } : { header: .96, thought: .94, dialogue: .94 };
    return {
        headerCss: `& { background: ${hexToRgba(v('headerBackground'), alpha.header)}; border: ${v('borderWidth')}px solid ${v('borderColor')}; border-radius: ${v('radius')}px; padding: ${v('padding')}px; color: ${v('textColor')}; box-shadow: ${shadowValue}; ${glassCss} }\n.cl-chat-header-core { display: flex; flex-direction: ${v('headerDirection')}; align-items: ${v('headerAlign')}; gap: 12px; width: 100%; }\n.cl-chat-portrait { transform: scale(${v('portraitScale') / 100}); border-radius: ${v('portraitRadius')}px; border: 1px solid ${v('accentColor')}; overflow: hidden; }\n.cl-chat-name { color: ${v('textColor')}; font-size: ${v('nameSize')}%; font-weight: ${v('nameWeight')}; text-transform: ${v('nameTransform')}; }\n.cl-chat-rule { background: ${v('accentColor')}; }\n.cl-chat-role { color: ${v('accentColor')}; ${v('showRole') ? '' : 'display: none;'} }\n.cl-chat-meta { ${v('showMeta') ? '' : 'display: none;'} }\n.cl-chat-wing { ${v('showWings') ? '' : 'display: none;'} }`,
        thoughtCss: `& { background: ${hexToRgba(v('thoughtBackground'), alpha.thought)}; border: ${v('borderWidth')}px solid ${v('borderColor')}; border-left: ${Math.max(2, v('borderWidth') + 2)}px solid ${v('accentColor')}; border-radius: ${v('radius')}px; padding: ${v('padding')}px; color: ${v('textColor')}; box-shadow: ${shadowValue}; ${glassCss} }\n.cl-chat-label { ${v('showThoughtLabel') ? '' : 'display: none;'} color: ${v('accentColor')}; }\n.cl-chat-content { text-align: ${v('contentAlign')}; line-height: ${v('contentLineHeight')}; max-width: ${v('contentMaxWidth')}%; margin-inline: auto; font-style: ${v('thoughtItalic') ? 'italic' : 'normal'}; }`,
        dialogueCss: `& { background: ${hexToRgba(v('dialogueBackground'), alpha.dialogue)}; border: ${v('borderWidth')}px solid ${v('borderColor')}; border-radius: ${v('radius')}px; padding: ${v('padding')}px; color: ${v('textColor')}; box-shadow: ${shadowValue}; ${glassCss} }\n.cl-chat-label { ${v('showDialogueLabel') ? '' : 'display: none;'} color: ${v('accentColor')}; }\n.cl-chat-content { text-align: ${v('contentAlign')}; line-height: ${v('contentLineHeight')}; max-width: ${v('contentMaxWidth')}%; margin-inline: auto; }`,
    };
}

function applyEasyDesign() { updateEasyOutputs(); setGeneratedCss(easyCss(), 'Easy mode'); }

function resetEasyDesign() {
    document.querySelectorAll('[data-cl-easy]').forEach(element => {
        const value = DEFAULT_EASY[element.dataset.clEasy];
        if (value === undefined) return;
        if (element.type === 'checkbox') element.checked = Boolean(value); else element.value = String(value);
    });
    applyEasyDesign();
}

function clearDraftCss() {
    if (!confirm('Clear the current Header, Monologue, and Dialogue custom CSS draft? Saved presets are not deleted.')) return;
    setGeneratedCss({ headerCss: '', thoughtCss: '', dialogueCss: '' }, 'Cleared');
}

function switchMode(mode) {
    const creator = document.getElementById(ENHANCER_ID);
    if (!creator) return;
    creator.dataset.mode = mode;
    creator.querySelectorAll('[data-cl-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.clMode === mode));
    creator.querySelector('[data-cl-easy-panel]')?.toggleAttribute('hidden', mode !== 'easy');
    const editors = document.querySelector('#character-life-css-studio .cl-css-editors');
    const help = document.querySelector('#character-life-css-studio .cl-css-help');
    if (editors) editors.hidden = mode !== 'advanced';
    if (help) help.hidden = mode !== 'advanced';
}

function setPreviewDevice(device) {
    const shell = document.querySelector('.cl-design-preview-shell');
    const preview = document.querySelector('.cl-design-preview');
    if (!shell || !preview) return;
    shell.dataset.device = device;
    preview.style.width = device === 'mobile' ? MOBILE_PREVIEW_WIDTH : '100%';
    preview.style.maxWidth = '100%'; preview.style.marginInline = 'auto';
    document.querySelectorAll('[data-cl-preview-device]').forEach(button => button.classList.toggle('is-active', button.dataset.clPreviewDevice === device));
}

function parseAiCss(raw) {
    let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = text.indexOf('{'); const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
    const data = JSON.parse(text);
    const result = {
        headerCss: typeof data.headerCss === 'string' ? data.headerCss : '',
        thoughtCss: typeof data.thoughtCss === 'string' ? data.thoughtCss : (typeof data.monologueCss === 'string' ? data.monologueCss : ''),
        dialogueCss: typeof data.dialogueCss === 'string' ? data.dialogueCss : '',
    };
    if (!result.headerCss && !result.thoughtCss && !result.dialogueCss) throw new Error('AI response did not include usable Character Life CSS.');
    return result;
}

async function generateWithAi(button) {
    const request = document.getElementById('character-life-ai-style-request')?.value?.trim();
    if (!request) throw new Error('Describe the design you want first.');
    const generator = SillyTavern?.getContext?.().generateQuietPrompt;
    if (typeof generator !== 'function') throw new Error('This SillyTavern build does not expose quiet AI generation to extensions.');
    const baseDesign = document.getElementById('character-life-preset-base')?.value || 'signature';
    const current = {
        headerCss: textArea('character-life-header-css')?.value || '',
        thoughtCss: textArea('character-life-thought-css')?.value || '',
        dialogueCss: textArea('character-life-dialogue-css')?.value || '',
    };
    const prompt = `CHARACTER LIFE DESIGN CSS ASSISTANT\nYou generate safe scoped CSS fragments for Character Life's custom design studio.\n\nUSER DESIGN REQUEST:\n${request}\n\nBASE DESIGN: ${baseDesign}\n\nCURRENT OPTIONAL CSS:\nHEADER:\n${current.headerCss || '(empty)'}\nMONOLOGUE:\n${current.thoughtCss || '(empty)'}\nDIALOGUE:\n${current.dialogueCss || '(empty)'}\n\nReturn ONLY one-line strict JSON with exactly these string keys: {"headerCss":"...","thoughtCss":"...","dialogueCss":"..."}. Escape line breaks inside strings as \\n.\nRules:\n- Generate only declarations or flat selector rules supported by Character Life. If a fragment needs both outer declarations and child rules, put outer declarations inside an & { ... } rule; never mix bare declarations with selector rules.\n- Never use @import, @media, @supports, @keyframes, @layer, @container, :global(), HTML, JavaScript, markdown fences, or nested CSS.\n- Valid child selectors include .cl-chat-header-core, .cl-chat-portrait, .cl-chat-identity, .cl-chat-name, .cl-chat-role, .cl-chat-meta, .cl-chat-wing, .cl-chat-label, and .cl-chat-content.\n- Use & at most once and only at the start of a selector.\n- Keep layouts responsive; do not use fixed widths wider than 100%.\n- Match the user's requested visual style strongly.\n- Keep each CSS string below 9000 characters.`;
    button.disabled = true; const old = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating design…';
    const status = document.getElementById('character-life-ai-style-status');
    if (status) status.textContent = 'Using your active SillyTavern model…';
    try {
        const result = parseAiCss(await generator(prompt));
        setGeneratedCss(result, 'AI helper'); switchMode('advanced');
        if (status) status.textContent = 'Generated. The code is in all three editors and the live preview has updated.';
        document.querySelector('.cl-design-preview-shell')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally { button.disabled = false; button.innerHTML = old; }
}

function creatorHtml() {
    return `<section id="${ENHANCER_ID}" class="cl-design-creator" data-mode="easy">
      <div class="cl-design-creator-head"><div><small>DESIGN CREATOR</small><strong>Create your own Character Life style</strong><p>Use visual controls, write CSS yourself, or describe a style and let your active SillyTavern model generate all three sections.</p></div><div class="cl-mode-switch"><button type="button" class="is-active" data-cl-mode="easy"><i class="fa-solid fa-sliders"></i> Easy</button><button type="button" data-cl-mode="advanced"><i class="fa-solid fa-code"></i> Advanced</button></div></div>
      <details class="cl-design-guide" open><summary><i class="fa-solid fa-circle-question"></i> How to create a design</summary><div class="cl-guide-grid">
        <article><b>1</b><strong>Start a preset</strong><span>Press <em>New</em>, name it, and choose a built-in design as the structural base.</span></article>
        <article><b>2</b><strong>Choose a mode</strong><span><em>Easy</em> uses visual controls. <em>Advanced</em> exposes Header, Monologue, and Dialogue CSS.</span></article>
        <article><b>3</b><strong>Watch live preview</strong><span>Easy changes, Advanced edits, and AI results all update the existing live preview.</span></article>
        <article><b>4</b><strong>Save or remove</strong><span>Use <em>Save & use preset</em>. Export/import JSON or delete the saved preset whenever you want.</span></article>
      </div><p class="cl-guide-note"><strong>Advanced selector guide:</strong> <code>.cl-chat-header-core</code>, <code>.cl-chat-portrait</code>, <code>.cl-chat-identity</code>, <code>.cl-chat-name</code>, <code>.cl-chat-role</code>, <code>.cl-chat-meta</code>, <code>.cl-chat-wing</code>, <code>.cl-chat-label</code>, and <code>.cl-chat-content</code>. CSS is automatically scoped to its component.</p></details>
      <section class="cl-ai-design-helper"><div class="cl-ai-design-title"><i class="fa-solid fa-wand-magic-sparkles"></i><div><strong>AI design helper</strong><span>Describe what you want. It uses the active SillyTavern model only when Generate is pressed.</span></div></div><textarea id="character-life-ai-style-request" rows="4" maxlength="5000" placeholder="Example: Dark fantasy guild dossier, thin gold borders, portrait left, large uppercase name, quiet italic monologue, compact dialogue cards, no decorative wings."></textarea><div class="cl-ai-design-actions"><button type="button" class="menu_button cl-ai-generate"><i class="fa-solid fa-sparkles"></i> Generate Header + Monologue + Dialogue CSS</button><output id="character-life-ai-style-status" aria-live="polite"></output></div></section>
      <section data-cl-easy-panel class="cl-easy-builder"><header><div><strong>Easy visual builder</strong><span>Changing these controls automatically fills the Advanced CSS editors.</span></div><div><button type="button" class="menu_button" data-cl-easy-reset><i class="fa-solid fa-arrow-rotate-left"></i> Reset easy controls</button><button type="button" class="menu_button" data-cl-clear-css><i class="fa-solid fa-eraser"></i> Clear draft CSS</button></div></header><div class="cl-easy-grid">
        <fieldset><legend>Colors</legend><label><span>Header background</span><input type="color" data-cl-easy="headerBackground" value="#171717"></label><label><span>Monologue background</span><input type="color" data-cl-easy="thoughtBackground" value="#20181d"></label><label><span>Dialogue background</span><input type="color" data-cl-easy="dialogueBackground" value="#171b22"></label><label><span>Border</span><input type="color" data-cl-easy="borderColor" value="#6f6f6f"></label><label><span>Text</span><input type="color" data-cl-easy="textColor" value="#f2f2f2"></label><label><span>Accent</span><input type="color" data-cl-easy="accentColor" value="#c39a62"></label></fieldset>
        <fieldset><legend>Panel shape</legend><label><span>Corner radius <output data-cl-easy-output="radius" data-suffix="px">14px</output></span><input type="range" min="0" max="40" data-cl-easy="radius" value="14"></label><label><span>Border width <output data-cl-easy-output="borderWidth" data-suffix="px">1px</output></span><input type="range" min="0" max="6" data-cl-easy="borderWidth" value="1"></label><label><span>Inner padding <output data-cl-easy-output="padding" data-suffix="px">14px</output></span><input type="range" min="4" max="32" data-cl-easy="padding" value="14"></label><label><span>Shadow <output data-cl-easy-output="shadow" data-suffix="px">18px</output></span><input type="range" min="0" max="48" data-cl-easy="shadow" value="18"></label><label class="cl-check"><input type="checkbox" data-cl-easy="glass"><span>Glass / blur background</span></label></fieldset>
        <fieldset><legend>Header layout</legend><label><span>Direction</span><select data-cl-easy="headerDirection"><option value="row">Portrait left</option><option value="row-reverse">Portrait right</option><option value="column">Portrait above</option><option value="column-reverse">Portrait below</option></select></label><label><span>Cross alignment</span><select data-cl-easy="headerAlign"><option value="center">Center</option><option value="flex-start">Start</option><option value="flex-end">End</option></select></label><label><span>Portrait scale <output data-cl-easy-output="portraitScale" data-suffix="%">100%</output></span><input type="range" min="60" max="140" step="5" data-cl-easy="portraitScale" value="100"></label><label><span>Portrait radius <output data-cl-easy-output="portraitRadius" data-suffix="px">14px</output></span><input type="range" min="0" max="50" data-cl-easy="portraitRadius" value="14"></label><label class="cl-check"><input type="checkbox" data-cl-easy="showMeta" checked><span>Show affiliation / gender / age</span></label><label class="cl-check"><input type="checkbox" data-cl-easy="showRole" checked><span>Show role / title</span></label><label class="cl-check"><input type="checkbox" data-cl-easy="showWings" checked><span>Show decorative wings</span></label></fieldset>
        <fieldset><legend>Typography & content</legend><label><span>Name size <output data-cl-easy-output="nameSize" data-suffix="%">118%</output></span><input type="range" min="80" max="180" step="2" data-cl-easy="nameSize" value="118"></label><label><span>Name weight</span><select data-cl-easy="nameWeight"><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700" selected>Bold</option><option value="800">Extra bold</option></select></label><label><span>Name casing</span><select data-cl-easy="nameTransform"><option value="none">Normal</option><option value="uppercase">UPPERCASE</option><option value="capitalize">Capitalize</option></select></label><label><span>Content alignment</span><select data-cl-easy="contentAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label><label><span>Line height <output data-cl-easy-output="contentLineHeight">1.65</output></span><input type="range" min="1.1" max="2.2" step="0.05" data-cl-easy="contentLineHeight" value="1.65"></label><label><span>Content width <output data-cl-easy-output="contentMaxWidth" data-suffix="%">100%</output></span><input type="range" min="55" max="100" step="5" data-cl-easy="contentMaxWidth" value="100"></label><label class="cl-check"><input type="checkbox" data-cl-easy="showThoughtLabel" checked><span>Show monologue label</span></label><label class="cl-check"><input type="checkbox" data-cl-easy="showDialogueLabel" checked><span>Show dialogue label / number</span></label><label class="cl-check"><input type="checkbox" data-cl-easy="thoughtItalic"><span>Italic monologue</span></label></fieldset>
      </div></section>
    </section>`;
}

function styleText() {
    return `#${ENHANCER_ID}{margin:14px 0 10px;padding:14px;border:1px solid color-mix(in srgb,var(--cl-ui-accent,#c39a62) 36%,transparent);border-radius:14px;background:color-mix(in srgb,var(--cl-ui-surface,#211e1b) 88%,transparent);color:var(--cl-ui-text,#eee8dc)}#${ENHANCER_ID} *{box-sizing:border-box}.cl-design-creator-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}.cl-design-creator-head small{display:block;font-size:.68em;letter-spacing:.16em;opacity:.7}.cl-design-creator-head strong{display:block;font-size:1.05em;margin-top:2px}.cl-design-creator-head p{margin:5px 0 0;opacity:.78;font-size:.88em;max-width:760px}.cl-mode-switch{display:flex;border:1px solid rgba(255,255,255,.12);border-radius:10px;overflow:hidden;flex:none}.cl-mode-switch button,.cl-preview-switch button{border:0;background:transparent;color:inherit;padding:8px 11px;cursor:pointer}.cl-mode-switch button.is-active,.cl-preview-switch button.is-active{background:var(--cl-ui-accent,#c39a62);color:#111}.cl-design-guide{margin-top:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:0 11px}.cl-design-guide summary{cursor:pointer;padding:10px 0;font-weight:700}.cl-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding-bottom:10px}.cl-guide-grid article{display:grid;grid-template-columns:28px 1fr;gap:2px 8px;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.025)}.cl-guide-grid article>b{grid-row:1/3;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:var(--cl-ui-accent,#c39a62);color:#111}.cl-guide-grid article span{font-size:.84em;opacity:.78}.cl-guide-note{font-size:.82em;line-height:1.55;padding-bottom:10px;margin:0}.cl-ai-design-helper{margin-top:12px;padding:11px;border:1px solid color-mix(in srgb,var(--cl-ui-accent,#c39a62) 28%,transparent);border-radius:10px;background:rgba(255,255,255,.025)}.cl-ai-design-title{display:flex;gap:9px;align-items:center;margin-bottom:8px}.cl-ai-design-title>i{font-size:1.25em;color:var(--cl-ui-accent,#c39a62)}.cl-ai-design-title strong,.cl-ai-design-title span{display:block}.cl-ai-design-title span{font-size:.82em;opacity:.72}.cl-ai-design-helper textarea{width:100%;resize:vertical;min-height:86px}.cl-ai-design-actions{display:flex;gap:10px;align-items:center;margin-top:8px;flex-wrap:wrap}.cl-ai-design-actions output{font-size:.82em;opacity:.78;min-width:180px;flex:1}.cl-easy-builder{margin-top:12px}.cl-easy-builder>header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}.cl-easy-builder>header strong,.cl-easy-builder>header span{display:block}.cl-easy-builder>header span{font-size:.8em;opacity:.7}.cl-easy-builder>header>div:last-child{display:flex;gap:6px;flex-wrap:wrap}.cl-easy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cl-easy-grid fieldset{min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px}.cl-easy-grid legend{padding:0 6px;font-weight:700;font-size:.84em}.cl-easy-grid label{display:grid;grid-template-columns:minmax(120px,1fr) minmax(120px,1.15fr);align-items:center;gap:8px;margin:7px 0;font-size:.82em}.cl-easy-grid label>span>output{float:right;opacity:.7}.cl-easy-grid input[type=range],.cl-easy-grid select{width:100%}.cl-easy-grid input[type=color]{width:100%;height:32px}.cl-easy-grid .cl-check{grid-template-columns:auto 1fr}.cl-css-studio .cl-css-editors[hidden],.cl-css-studio .cl-css-help[hidden]{display:none!important}.cl-design-preview-shell{overflow-x:auto}.cl-design-preview{transition:width .2s ease}.cl-preview-switch{display:flex;gap:5px;margin:8px 0}.cl-preview-switch button{border:1px solid rgba(255,255,255,.12);border-radius:8px}.cl-design-preview-shell[data-device=mobile] .cl-design-preview{outline:1px dashed rgba(255,255,255,.16);outline-offset:4px}@media(max-width:720px){.cl-design-creator-head,.cl-easy-builder>header{flex-direction:column;align-items:stretch}.cl-mode-switch{width:100%}.cl-mode-switch button{flex:1}.cl-guide-grid,.cl-easy-grid{grid-template-columns:1fr}.cl-easy-grid label{grid-template-columns:1fr}.cl-ai-design-actions{align-items:stretch}.cl-ai-design-actions .menu_button{width:100%}}`;
}

function enhanceStudio(studio) {
    if (!studio || document.getElementById(ENHANCER_ID)) return;
    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = styleText(); document.head.append(style);
    }
    studio.insertAdjacentHTML('afterbegin', creatorHtml());
    const creator = document.getElementById(ENHANCER_ID);
    creator.querySelectorAll('[data-cl-mode]').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.clMode)));
    creator.querySelectorAll('[data-cl-easy]').forEach(element => element.addEventListener(element.matches('select,input[type="checkbox"]') ? 'change' : 'input', applyEasyDesign));
    creator.querySelector('[data-cl-easy-reset]')?.addEventListener('click', resetEasyDesign);
    creator.querySelector('[data-cl-clear-css]')?.addEventListener('click', clearDraftCss);
    creator.querySelector('.cl-ai-generate')?.addEventListener('click', event => void generateWithAi(event.currentTarget).catch(error => notify('error', error.message)));
    const previewShell = document.querySelector('.cl-design-preview-shell');
    if (previewShell && !previewShell.querySelector('.cl-preview-switch')) {
        previewShell.insertAdjacentHTML('afterbegin', '<div class="cl-preview-switch"><button type="button" class="is-active" data-cl-preview-device="desktop"><i class="fa-solid fa-desktop"></i> Desktop</button><button type="button" data-cl-preview-device="mobile"><i class="fa-solid fa-mobile-screen"></i> Mobile</button></div>');
        previewShell.querySelectorAll('[data-cl-preview-device]').forEach(button => button.addEventListener('click', () => setPreviewDevice(button.dataset.clPreviewDevice)));
    }
    const actions = studio.querySelector('.cl-css-actions');
    if (actions && !actions.querySelector('[data-cl-remove-current]')) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'menu_button'; remove.dataset.clRemoveCurrent = 'true';
        remove.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove current preset';
        remove.addEventListener('click', () => document.getElementById('character-life-preset-delete')?.click()); actions.append(remove);
    }
    updateEasyOutputs(creator); switchMode('easy'); setPreviewDevice('desktop');
}

function observeStudio() {
    const tryEnhance = () => { const studio = document.getElementById('character-life-css-studio'); if (studio) { enhanceStudio(studio); return true; } return false; };
    if (tryEnhance()) return;
    const observer = new MutationObserver(() => { if (tryEnhance()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeStudio, { once: true }); else observeStudio();
console.info("[Character Life's] Design Creator enhancer loaded.");
