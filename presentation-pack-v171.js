/* global SillyTavern */

import './theme-studio-v171.js';

const PACK_FLAG = 'presentationPackV171';
const PACK_GROUP = 'Character Life design pack';
const MARKER = '/* CHARACTER-LIFE-INDEPENDENT-THEME:v1 */';
const STYLE_ID = 'character-life-presentation-pack-v171';
const PACK = [
    {
        id: 'tactical-vector',
        name: 'Tactical Vector',
        headerCss: `${MARKER}\n& { padding: var(--cl-chat-header-pad) 0; }\n.cl-chat-header-core { position: relative; width: var(--cl-content-rail); max-width: 100%; padding: calc(var(--cl-chat-pad-y) + 2px) var(--cl-chat-pad-x); gap: var(--cl-chat-header-gap); border: 1px solid color-mix(in srgb, var(--cl-local-header) 64%, transparent); border-left: 4px solid var(--cl-local-header); background: transparent; clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cl-local-header) 12%, transparent); }\n.cl-chat-header-core::after { content: ''; position: absolute; right: 14px; top: 8px; width: 44px; height: 3px; background: linear-gradient(90deg, transparent, var(--cl-local-header)); opacity: .75; }\n.cl-chat-portrait { border: 2px solid var(--cl-local-header); box-shadow: 0 0 14px color-mix(in srgb, var(--cl-local-header) 24%, transparent); }\n.cl-chat-identity { min-width: 0; gap: 3px; }\n.cl-chat-name { font-size: 1.12em; font-weight: 760; letter-spacing: .07em; text-transform: uppercase; }\n.cl-chat-role { color: var(--cl-local-header); font-size: .69em; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }\n.cl-chat-rule { display: block; width: min(160px, 42vw); height: 2px; background: linear-gradient(90deg, var(--cl-local-header), transparent); }\n.cl-chat-meta { gap: 3px 9px; font-size: .7em; letter-spacing: .065em; text-transform: uppercase; }\n.cl-chat-wing { display: none; }`,
        thoughtCss: `& { position: relative; padding: var(--cl-chat-pad-y) var(--cl-chat-pad-x); color: var(--SmartThemeBodyColor, #eee8dc); background: transparent; border: 1px solid color-mix(in srgb, var(--cl-local-thought) 52%, transparent); border-left: 4px solid var(--cl-local-thought); clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 0 100%); }\n.cl-chat-label { color: var(--cl-local-thought); font-size: .72em; letter-spacing: .12em; text-transform: uppercase; }\n.cl-chat-label > span { width: 22px; height: 2px; background: var(--cl-local-thought); }\n.cl-chat-content { line-height: 1.62; font-style: italic; }`,
        dialogueCss: `& { position: relative; padding: var(--cl-chat-pad-y) var(--cl-chat-pad-x) calc(var(--cl-chat-pad-y) + 2px); color: var(--SmartThemeBodyColor, #eee8dc); background: linear-gradient(90deg, color-mix(in srgb, var(--cl-local-dialogue) 7%, transparent), transparent 58%); border: 1px solid color-mix(in srgb, var(--cl-local-dialogue) 42%, transparent); border-bottom: 3px solid var(--cl-local-dialogue); clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); }\n.cl-chat-label { color: var(--cl-local-dialogue); font-size: .72em; letter-spacing: .12em; text-transform: uppercase; }\n.cl-chat-label > span { width: 28px; height: 2px; background: linear-gradient(90deg, var(--cl-local-dialogue), transparent); }\n.cl-chat-content { line-height: 1.62; }`,
    },
    {
        id: 'arcane-regalia',
        name: 'Arcane Regalia',
        headerCss: `${MARKER}\n& { padding: var(--cl-chat-header-pad) 0; }\n.cl-chat-header-core { position: relative; width: var(--cl-content-rail); max-width: 100%; padding: calc(var(--cl-chat-pad-y) + 4px) calc(var(--cl-chat-pad-x) + 4px); gap: var(--cl-chat-header-gap); border: 1px solid color-mix(in srgb, var(--cl-local-header) 50%, transparent); background: linear-gradient(90deg, color-mix(in srgb, var(--cl-local-header) 5%, transparent), transparent 32%, color-mix(in srgb, var(--cl-local-header) 4%, transparent)); box-shadow: inset 0 0 22px color-mix(in srgb, #000 18%, transparent); }\n.cl-chat-header-core::before { content: ''; position: absolute; inset: 5px; pointer-events: none; border-top: 1px solid color-mix(in srgb, var(--cl-local-header) 24%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--cl-local-header) 18%, transparent); }\n.cl-chat-portrait { border: 1px solid color-mix(in srgb, var(--cl-local-header) 78%, #d8bd78 22%); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cl-local-header) 10%, transparent), 0 0 18px color-mix(in srgb, var(--cl-local-header) 14%, transparent); }\n.cl-chat-identity { min-width: 0; gap: 3px; }\n.cl-chat-name { font-size: 1.15em; font-weight: 650; letter-spacing: .035em; }\n.cl-chat-role { color: color-mix(in srgb, var(--cl-local-header) 76%, #e2c98f 24%); font-size: .68em; letter-spacing: .16em; text-transform: uppercase; }\n.cl-chat-rule { display: block; width: 74px; height: 1px; background: linear-gradient(90deg, transparent, var(--cl-local-header), transparent); }\n.cl-chat-meta { gap: 3px 8px; font-size: .7em; letter-spacing: .045em; }\n.cl-chat-wing { display: none; }`,
        thoughtCss: `& { position: relative; padding: calc(var(--cl-chat-pad-y) + 2px) calc(var(--cl-chat-pad-x) + 3px); color: var(--SmartThemeBodyColor, #eee8dc); background: transparent; border: 1px solid color-mix(in srgb, var(--cl-local-thought) 34%, #a98b56 16%); box-shadow: inset 0 0 24px color-mix(in srgb, var(--cl-local-thought) 4%, transparent); }\n&::before { content: ''; position: absolute; left: 9px; top: -1px; width: 48px; height: 2px; background: var(--cl-local-thought); }\n.cl-chat-label { color: color-mix(in srgb, var(--cl-local-thought) 72%, #d8c18b 28%); font-size: .72em; letter-spacing: .11em; text-transform: uppercase; }\n.cl-chat-label > span { width: 7px; height: 7px; border: 1px solid currentColor; background: transparent; transform: rotate(45deg); }\n.cl-chat-content { line-height: 1.68; font-style: italic; }`,
        dialogueCss: `& { position: relative; padding: calc(var(--cl-chat-pad-y) + 2px) calc(var(--cl-chat-pad-x) + 3px); color: var(--SmartThemeBodyColor, #eee8dc); background: linear-gradient(90deg, color-mix(in srgb, var(--cl-local-dialogue) 4%, transparent), transparent 62%); border: 1px solid color-mix(in srgb, var(--cl-local-dialogue) 34%, #8f7650 16%); border-left: 3px solid var(--cl-local-dialogue); }\n&::after { content: ''; position: absolute; right: 10px; bottom: -1px; width: 72px; height: 1px; background: linear-gradient(90deg, transparent, var(--cl-local-dialogue)); }\n.cl-chat-label { color: color-mix(in srgb, var(--cl-local-dialogue) 76%, #d9c08b 24%); font-size: .72em; letter-spacing: .1em; text-transform: uppercase; }\n.cl-chat-label > span { width: 22px; height: 1px; background: currentColor; }\n.cl-chat-content { line-height: 1.68; }`,
    },
];

const PROFILE_FIELDS = [
    ['role', 'Role'], ['affiliation', 'Affiliation'], ['pronouns', 'Pronouns'], ['gender', 'Gender'], ['age', 'Age'], ['species', 'Species'],
    ['appearance', 'Appearance'], ['personality', 'Personality'], ['relationship', 'Relationship'], ['background', 'Background'],
    ['goals', 'Goals'], ['abilities', 'Abilities'], ['speechStyle', 'Speech style'], ['currentState', 'Current state'], ['notes', 'Notes'],
];

function escapeSelector(value) {
    return globalThis.CSS?.escape ? CSS.escape(String(value || '')) : String(value || '').replace(/["\\]/g, '\\$&');
}

function characterKey(context) {
    const group = context.groupId ?? context.group?.id;
    if (group !== undefined && group !== null && group !== '') return `group:${group}`;
    const characterId = context.characterId ?? context.character?.id;
    const character = context.character || (Array.isArray(context.characters) ? context.characters[characterId] : null);
    const avatar = String(character?.avatar || '').trim();
    const name = String(context.name2 || character?.name || 'unknown').trim();
    return `character:${avatar || characterId || name}`;
}

function rootSettings() {
    return SillyTavern?.getContext?.().extensionSettings?.character_life || null;
}

function resolveNpc(name) {
    const context = SillyTavern?.getContext?.();
    const root = rootSettings();
    if (!context || !root || !name) return null;
    const libraries = [
        Array.isArray(root.globalNpcs) ? root.globalNpcs : [],
        Array.isArray(root.characterNpcs?.[characterKey(context)]) ? root.characterNpcs[characterKey(context)] : [],
        Array.isArray(context.chatMetadata?.character_life_npcs?.npcs) ? context.chatMetadata.character_life_npcs.npcs : [],
    ];
    const wanted = String(name).trim().toLocaleLowerCase();
    let found = null;
    for (const list of libraries) {
        for (const npc of list) {
            const aliases = Array.isArray(npc?.aliases) ? npc.aliases : String(npc?.aliases || '').split(',');
            if ([npc?.name, ...aliases].some(value => String(value || '').trim().toLocaleLowerCase() === wanted)) found = npc;
        }
    }
    return found;
}

function clean(value) {
    return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function addMetaSpan(meta, className, value) {
    let span = meta.querySelector(`.${className}`);
    if (!span) {
        span = document.createElement('span');
        span.className = className;
        meta.append(span);
    }
    span.textContent = clean(value);
}

function buildProfileDetails(header, npc) {
    header.querySelector('.cl-chat-profile-details')?.remove();
    const rows = PROFILE_FIELDS.map(([key, label]) => [label, clean(npc?.[key])]).filter(([, value]) => value);
    if (npc?.adultProfile && clean(npc?.adultAppearance)) rows.push(['Adult appearance', clean(npc.adultAppearance)]);
    if (!rows.length) return;
    const details = document.createElement('details');
    details.className = 'cl-chat-profile-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Character profile';
    const grid = document.createElement('div');
    grid.className = 'cl-chat-profile-grid';
    for (const [label, value] of rows) {
        const row = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = label;
        const span = document.createElement('span');
        span.textContent = value;
        row.append(strong, span);
        grid.append(row);
    }
    details.append(summary, grid);
    header.querySelector('.cl-chat-identity')?.append(details);
}

function enrichHeader(header) {
    const npc = resolveNpc(header.dataset.clName);
    if (!npc) return;
    const identity = header.querySelector('.cl-chat-identity');
    const meta = identity?.querySelector('.cl-chat-meta');
    if (!identity || !meta) return;
    addMetaSpan(meta, 'cl-chat-pronouns', npc.pronouns);
    addMetaSpan(meta, 'cl-chat-species', npc.species);
    buildProfileDetails(header, npc);
}

let enrichTimer = 0;
function scheduleEnrich(delay = 60) {
    clearTimeout(enrichTimer);
    enrichTimer = setTimeout(() => {
        document.querySelectorAll('.mes_text.character-life-rendered .cl-chat-header[data-cl-name]').forEach(enrichHeader);
    }, delay);
}

function seedDesigns() {
    const context = SillyTavern?.getContext?.();
    const root = rootSettings();
    if (!context || !root) return false;
    root.customDesigns = Array.isArray(root.customDesigns) ? root.customDesigns : [];
    if (!root[PACK_FLAG]) {
        for (const design of PACK) {
            if (root.customDesigns.some(item => item?.id === design.id)) continue;
            const now = new Date().toISOString();
            root.customDesigns.push({ ...design, base: 'clean', createdAt: now, updatedAt: now });
        }
        root[PACK_FLAG] = true;
        context.saveSettingsDebounced?.();
    }
    return true;
}

function syncDesignOptions() {
    const select = document.getElementById('character-life-design');
    const root = rootSettings();
    if (!(select instanceof HTMLSelectElement) || !root) return;
    let group = select.querySelector('optgroup[data-cl-presentation-pack]');
    if (!group) {
        group = document.createElement('optgroup');
        group.label = PACK_GROUP;
        group.dataset.clPresentationPack = 'true';
        select.append(group);
    }
    for (const design of PACK) {
        const exists = root.customDesigns?.some(item => item?.id === design.id);
        let option = select.querySelector(`option[value="custom:${escapeSelector(design.id)}"]`);
        if (!exists) {
            option?.remove();
            continue;
        }
        if (!option) {
            option = document.createElement('option');
            option.value = `custom:${design.id}`;
        }
        option.textContent = design.name;
        group.append(option);
    }
    if (!group.children.length) group.remove();
}

function installCss() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* Restore Character Life settings for independent blank-canvas themes. */
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="left"] .cl-chat-header{justify-content:flex-start}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="center"] .cl-chat-header{justify-content:center}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="right"] .cl-chat-header{justify-content:flex-end}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="left"] .cl-chat-header-core{justify-content:flex-start}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="center"] .cl-chat-header-core{justify-content:center}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="right"] .cl-chat-header-core{justify-content:flex-end}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="left"] :is(.cl-chat-thought,.cl-chat-dialogue) > :is(.cl-chat-label,.cl-chat-content){margin-left:0;margin-right:auto}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="center"] :is(.cl-chat-thought,.cl-chat-dialogue) > :is(.cl-chat-label,.cl-chat-content){margin-inline:auto}
.mes_text.character-life-rendered[data-cl-independent][data-cl-position="right"] :is(.cl-chat-thought,.cl-chat-dialogue) > :is(.cl-chat-label,.cl-chat-content){margin-left:auto;margin-right:0}
.mes_text.character-life-rendered[data-cl-independent][data-cl-shape="square"] .cl-chat-portrait{width:var(--cl-portrait-size);height:var(--cl-portrait-size);flex-basis:var(--cl-portrait-size);border-radius:0;clip-path:none}
.mes_text.character-life-rendered[data-cl-independent][data-cl-shape="rounded"] .cl-chat-portrait{width:var(--cl-portrait-size);height:var(--cl-portrait-size);flex-basis:var(--cl-portrait-size);border-radius:18%;clip-path:none}
.mes_text.character-life-rendered[data-cl-independent][data-cl-shape="portrait"] .cl-chat-portrait{width:calc(var(--cl-portrait-size)*.78);height:calc(var(--cl-portrait-size)*1.18);flex-basis:calc(var(--cl-portrait-size)*.78);border-radius:0;clip-path:none}
.mes_text.character-life-rendered[data-cl-independent][data-cl-shape="circle"] .cl-chat-portrait{width:var(--cl-portrait-size);height:var(--cl-portrait-size);flex-basis:var(--cl-portrait-size);border-radius:50%;clip-path:none}
.mes_text.character-life-rendered[data-cl-independent][data-cl-shape="hexagon"] .cl-chat-portrait{width:var(--cl-portrait-size);height:var(--cl-portrait-size);flex-basis:var(--cl-portrait-size);border-radius:0;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%)}
.mes_text.character-life-rendered[data-cl-independent][data-cl-missing="hidden"] .cl-chat-portrait:not(.has-image){display:none}

/* Manga Light / Noir alignment follows Header position. */
.mes_text[data-cl-design^="manga-"][data-cl-position="left"] .cl-chat-identity{text-align:left;justify-items:start}
.mes_text[data-cl-design^="manga-"][data-cl-position="center"] .cl-chat-identity{text-align:center;justify-items:center}
.mes_text[data-cl-design^="manga-"][data-cl-position="right"] .cl-chat-identity{text-align:right;justify-items:end}
.mes_text[data-cl-design^="manga-"][data-cl-position="left"] .cl-chat-meta{justify-content:flex-start}
.mes_text[data-cl-design^="manga-"][data-cl-position="center"] .cl-chat-meta{justify-content:center}
.mes_text[data-cl-design^="manga-"][data-cl-position="right"] .cl-chat-meta{justify-content:flex-end}
.mes_text[data-cl-design^="manga-"][data-cl-position="left"] .cl-chat-rule{margin-left:0;margin-right:auto}
.mes_text[data-cl-design^="manga-"][data-cl-position="center"] .cl-chat-rule{margin-inline:auto}
.mes_text[data-cl-design^="manga-"][data-cl-position="right"] .cl-chat-rule{margin-left:auto;margin-right:0}

/* Manga Light — transparent framed editorial system. */
.mes_text[data-cl-design="manga-light"] .cl-chat-header-core{position:relative;padding:calc(var(--cl-chat-pad-y) + 2px) calc(var(--cl-chat-pad-x) + 2px);border:1px solid color-mix(in srgb,var(--cl-local-header) 42%,#d6c69b 28%);background:transparent;box-shadow:none}
.mes_text[data-cl-design="manga-light"] .cl-chat-header-core::before,.mes_text[data-cl-design="manga-light"] .cl-chat-header-core::after{content:'';position:absolute;width:18px;height:18px;pointer-events:none;border-color:var(--cl-local-header)}
.mes_text[data-cl-design="manga-light"] .cl-chat-header-core::before{left:-1px;top:-1px;border-left:2px solid;border-top:2px solid}
.mes_text[data-cl-design="manga-light"] .cl-chat-header-core::after{right:-1px;bottom:-1px;border-right:2px solid;border-bottom:2px solid}
.mes_text[data-cl-design="manga-light"] .cl-chat-thought{color:color-mix(in srgb,var(--SmartThemeBodyColor,#eee8dc) 84%,#d7c8a2 16%);background:transparent;border:1px solid color-mix(in srgb,var(--cl-local-thought) 42%,#d7c8a2 30%);border-left:3px solid var(--cl-local-thought);box-shadow:none}
.mes_text[data-cl-design="manga-light"] .cl-chat-thought .cl-chat-label{color:color-mix(in srgb,var(--cl-local-thought) 74%,#e7d7ae 26%);border-bottom:1px solid color-mix(in srgb,var(--cl-local-thought) 24%,transparent)}
.mes_text[data-cl-design="manga-light"] .cl-chat-dialogue{color:var(--SmartThemeBodyColor,#eee8dc);background:linear-gradient(90deg,color-mix(in srgb,var(--cl-local-dialogue) 5%,transparent),transparent 55%);border:1px solid color-mix(in srgb,var(--cl-local-dialogue) 34%,#d8c99e 18%);border-left:4px solid var(--cl-local-dialogue);box-shadow:none;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))}

/* Manga Noir — portrait stays left; same transparent framed language, darker ink. */
.mes_text[data-cl-design="manga-noir"] .cl-chat-portrait{order:0;background:color-mix(in srgb,var(--SmartThemeBlurTintColor,#0d0d10) 92%,transparent);border-color:color-mix(in srgb,var(--cl-local-header) 50%,#888 18%)}
.mes_text[data-cl-design="manga-noir"] .cl-chat-identity{order:1}
.mes_text[data-cl-design="manga-noir"] .cl-chat-header-core{position:relative;padding:calc(var(--cl-chat-pad-y) + 2px) calc(var(--cl-chat-pad-x) + 2px);border:1px solid color-mix(in srgb,var(--cl-local-header) 38%,#6d6d72 24%);background:transparent;box-shadow:none}
.mes_text[data-cl-design="manga-noir"] .cl-chat-header-core::before{content:'';position:absolute;left:-1px;top:10px;bottom:10px;width:3px;background:var(--cl-local-header)}
.mes_text[data-cl-design="manga-noir"] .cl-chat-thought{color:var(--SmartThemeBodyColor,#eee8dc);background:transparent;border:1px solid color-mix(in srgb,var(--cl-local-thought) 34%,#5e5e64 24%);border-left:3px solid var(--cl-local-thought);box-shadow:none}
.mes_text[data-cl-design="manga-noir"] .cl-chat-thought .cl-chat-label{color:color-mix(in srgb,var(--cl-local-thought) 76%,#e8e8ea 24%);border-bottom:1px solid color-mix(in srgb,var(--cl-local-thought) 18%,transparent)}
.mes_text[data-cl-design="manga-noir"] .cl-chat-dialogue{color:var(--SmartThemeBodyColor,#eee8dc);background:linear-gradient(90deg,color-mix(in srgb,var(--cl-local-dialogue) 5%,transparent),transparent 60%);border:1px solid color-mix(in srgb,var(--cl-local-dialogue) 38%,#555 20%);border-left:4px solid var(--cl-local-dialogue);box-shadow:none;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}

/* Empty metadata never occupies space. */
.mes_text.character-life-rendered .cl-chat-meta span:empty{display:none!important}
.mes_text.character-life-rendered .cl-chat-profile-details{margin-top:6px;width:min(100%,620px);font-size:.72em;text-align:left}
.mes_text.character-life-rendered .cl-chat-profile-details summary{cursor:pointer;color:var(--cl-local-header);letter-spacing:.08em;text-transform:uppercase;list-style:none;opacity:.88}
.mes_text.character-life-rendered .cl-chat-profile-details summary::-webkit-details-marker{display:none}
.mes_text.character-life-rendered .cl-chat-profile-details summary::before{content:'＋';margin-right:6px}
.mes_text.character-life-rendered .cl-chat-profile-details[open] summary::before{content:'−'}
.mes_text.character-life-rendered .cl-chat-profile-grid{display:grid;gap:4px;margin-top:7px;padding:8px 9px;border:1px solid color-mix(in srgb,var(--cl-local-header) 18%,transparent);background:color-mix(in srgb,var(--SmartThemeBlurTintColor,#17130f) 42%,transparent)}
.mes_text.character-life-rendered .cl-chat-profile-grid>div{display:grid;grid-template-columns:minmax(78px,.28fr) minmax(0,1fr);gap:8px;align-items:start}
.mes_text.character-life-rendered .cl-chat-profile-grid strong{color:color-mix(in srgb,var(--cl-local-header) 74%,var(--SmartThemeBodyColor,#eee8dc) 26%);font-weight:650}
.mes_text.character-life-rendered .cl-chat-profile-grid span{white-space:normal;overflow-wrap:anywhere;color:color-mix(in srgb,var(--SmartThemeBodyColor,#eee8dc) 76%,transparent);text-transform:none;letter-spacing:normal}
@media(max-width:520px){.mes_text.character-life-rendered .cl-chat-profile-grid>div{grid-template-columns:1fr}.mes_text[data-cl-design^="manga-"] .cl-chat-header-core{align-items:flex-start}.mes_text[data-cl-design^="manga-"] .cl-chat-identity{min-width:0}.mes_text.character-life-rendered .cl-chat-profile-details{width:100%}}
`;
    document.head.append(style);
}

function start() {
    installCss();
    const run = () => {
        if (!seedDesigns()) return false;
        syncDesignOptions();
        scheduleEnrich(40);
        return true;
    };
    if (!run()) {
        const wait = setInterval(() => { if (run()) clearInterval(wait); }, 120);
        setTimeout(() => clearInterval(wait), 12000);
    }
    const observer = new MutationObserver(() => {
        syncDesignOptions();
        scheduleEnrich();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => scheduleEnrich(0), 180);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
