// Run with Playwright installed: node tests/portraits-browser.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { webkit, chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../character-life.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../character-life.css'), 'utf8');
function extract(name) {
    const start = source.search(new RegExp('^        (?:async )?function ' + name + '\\(', 'm'));
    assert.notEqual(start, -1, name);
    return source.slice(start, source.indexOf('\n        }', start) + '\n        }'.length);
}
const functions = ['chatAwareNpc', 'getChatAwareLibrary', 'npcEnabledForRuntime', 'effectiveNpcs', 'resolveNpc', 'chooseForm', 'portraitUrl', 'hydrateChat', 'hydrateChatPortrait', 'findMessageText', 'renderMessage', 'stripMarkup', 'colorStyle', 'headerBlock'].map(extract).join('\n');
(async () => {
    for (const [engine, browserType] of Object.entries({ webkit, chromium })) {
        const browser = await browserType.launch({ headless: true });
        try {
            const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://portrait.test/**', route => route.fulfill({
                contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#b88761"/></svg>',
            }));
            await page.setContent('<style>:root{--cl-portrait-size:76px}#chat{height:700px;overflow:auto}</style><div id="chat"><div class="mes" mesid="0"><div class="mes_text character-life-rendered" data-cl-design="chronicle" data-cl-shape="rounded"><p id="narrative">Existing narrative stays intact.</p></div></div></div>');
            await page.addStyleTag({ content: css });
            await page.addScriptTag({ content: `
                const live = {id:'npc1',name:'Finnegan Grimaldi',aliases:[],forms:[],activeFormId:'',role:'New role',enabled:true};
                const originals = {'character:npc1': {...structuredClone(live),role:'Original role'}};
                const libraries = {global:[],character:[live],chat:[]};
                const assets = {};
                let chatPortraitObserver = null;
                const portraitUrls = new Map();
                const clone = structuredClone, normalizeNpc = value => structuredClone(value), npcProfileSnapshot = value => structuredClone(value);
                const hasChat = () => true, ensureChatOriginals = () => ({originalSources:originals});
                const getLibrary = scope => structuredClone(libraries[scope]);
                const cleanText = (value,fallback='') => typeof value === 'string' ? value.trim() : fallback;
                const slug = value => String(value || '').toLowerCase();
                const escapeHtml = value => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
                const rootSettings = () => ({config:{persistentMedia:{assets}}});
                const portraitGet = async () => {throw Error('Simulated unavailable local image database')};
                const npcPalette = () => ({header:'#b88761',thought:'#b88761',dialogue:'#b88761'});
                const ensurePortraitPalette = async () => {}, tr = value => value;
                const getConfig = () => ({enabled:true});
                const containsSpeakerMarkup = () => false;
                const SillyTavern = {getContext:()=>({chat:[{}]})};
                ${functions}
                const root = document.querySelector('.mes_text');
                root.insertAdjacentHTML('afterbegin',headerBlock(live.name,''));
                window.fixture = {live,libraries,assets,render:()=>renderMessage(0)};
                fixture.render();
            ` });
            const img = page.locator('.cl-chat-portrait img');
            assert.equal(await img.getAttribute('src'), null);
            // Existing header + old chat snapshot; add image after initial rendering.
            await page.evaluate(() => {
                fixture.live.forms = [{id:'form',name:'Court',portraitId:'portrait',x:40,y:20,zoom:1.2}];
                fixture.live.activeFormId = 'form';
                fixture.assets.portrait = {path:'https://portrait.test/first.svg'};
                fixture.render();
            });
            await page.waitForFunction(() => { const i=document.querySelector('.cl-chat-portrait img');return !i.hidden && i.complete && i.naturalWidth > 0; });
            assert.equal(await img.isVisible(), true);
            assert.equal(await page.locator('.cl-chat-role').textContent(), 'Original role');
            // Hidden linked chat override still follows current source media.
            await page.evaluate(() => {
                fixture.libraries.chat.push({...structuredClone(fixture.live),id:'override',sourceScope:'character',sourceId:'npc1',forms:[],activeFormId:'',role:'Chat role'});
                fixture.assets.portrait.path = 'https://portrait.test/replaced.svg';
                fixture.render();
            });
            await page.waitForFunction(() => document.querySelector('.cl-chat-portrait img').src.endsWith('/replaced.svg'));
            assert.equal(await page.locator('.cl-chat-role').textContent(), 'Chat role');
            await page.evaluate(() => {fixture.live.forms=[];fixture.live.activeFormId='';fixture.render();});
            await page.waitForFunction(() => document.querySelector('.cl-chat-portrait img').hidden);
            assert.equal(await page.locator('.cl-chat-portrait').evaluate(el => el.classList.contains('has-image')), false);
            assert.equal(await page.locator('#narrative').textContent(), 'Existing narrative stays intact.');
            assert.deepEqual(errors, []);
            console.log(engine + ': mobile portrait addition, linked override, replacement, removal and narrative preservation passed');
        } finally { await browser.close(); }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
