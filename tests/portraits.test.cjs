const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../character-life.js'), 'utf8');
// Exercise the shipped bundle functions without booting SillyTavern's UI.
function extract(name) {
    const start = source.search(new RegExp('^        (?:async )?function ' + name + '\\(', 'm'));
    assert.notEqual(start, -1, name);
    const end = source.indexOf('\n        }', start) + '\n        }'.length;
    return source.slice(start, end);
}
function fixture(extra = {}) {
    const live = { id: 'npc1', name: 'Finnegan Grimaldi', aliases: [], forms: [], activeFormId: '', role: 'New role', enabled: true };
    const originals = { 'character:npc1': { ...structuredClone(live), role: 'Original role' } };
    const libraries = { global: [], character: [live], chat: [] };
    const assets = {};
    const sandbox = {
        hasChat: () => true, ensureChatOriginals: () => ({ originalSources: originals }),
        clone: structuredClone, normalizeNpc: structuredClone, npcProfileSnapshot: value => structuredClone(value),
        getLibrary: scope => structuredClone(libraries[scope]),
        cleanText: (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback,
        slug: value => String(value || '').toLowerCase(), rootSettings: () => ({ config: { persistentMedia: { assets } } }),
        portraitUrls: new Map(), portraitGet: async () => null,
        URL: { createObjectURL: () => 'blob:local' }, ...extra,
    };
    vm.createContext(sandbox);
    vm.runInContext(['chatAwareNpc', 'getChatAwareLibrary', 'npcEnabledForRuntime', 'effectiveNpcs', 'resolveNpc', 'chooseForm', 'portraitUrl', 'hydrateChatPortrait', 'renderMessage'].map(extract).join('\n'), sandbox);
    return { sandbox, live, originals, libraries, assets };
}
function addPortrait(npc, id = 'new') {
    npc.forms = [{ id, name: 'Court', portraitId: 'portrait-' + id, x: 40, y: 20, zoom: 1.2 }];
    npc.activeFormId = id;
}
test('portrait added after chat snapshot appears without resetting story or mutating snapshot', () => {
    const { sandbox: s, live, originals } = fixture();
    addPortrait(live);
    const npc = s.resolveNpc(live.name).npc;
    assert.equal(s.chooseForm(npc, '').portraitId, 'portrait-new');
    assert.equal(npc.role, 'Original role');
    assert.equal(originals['character:npc1'].forms.length, 0);
    npc.forms[0].x = 90;
    assert.equal(live.forms[0].x, 40);
});
test('linked chat AI override keeps story state but follows source form addition/replacement/deletion', () => {
    const { sandbox: s, live, libraries } = fixture();
    libraries.chat.push({ ...structuredClone(live), id: 'override', sourceScope: 'character', sourceId: live.id, role: 'Chat role', isDead: true });
    addPortrait(live);
    let npc = s.resolveNpc(live.name).npc;
    assert.equal(npc.role, 'Chat role');
    assert.equal(npc.isDead, true);
    assert.equal(s.chooseForm(npc, '').portraitId, 'portrait-new');
    addPortrait(live, 'replacement');
    assert.equal(s.chooseForm(s.resolveNpc(live.name).npc, 'new').portraitId, 'portrait-replacement');
    live.forms = []; live.activeFormId = '';
    assert.equal(s.chooseForm(s.resolveNpc(live.name).npc, ''), null);
});
test('standalone chat NPC and explicit alternate form retain their portraits', () => {
    const { sandbox: s, live, libraries } = fixture();
    const standalone = { ...structuredClone(live), id: 'standalone' };
    addPortrait(standalone, 'chat-only');
    libraries.chat.push(standalone);
    assert.equal(s.chooseForm(s.resolveNpc(live.name).npc, '').portraitId, 'portrait-chat-only');
    const alternate = { id: 'alt', name: 'Battle', portraitId: 'battle' };
    standalone.forms.push(alternate);
    assert.equal(s.chooseForm(s.resolveNpc(live.name).npc, 'Battle').portraitId, 'battle');
});
test('same name across scopes never borrows an unrelated portrait', () => {
    const { sandbox: s, live, libraries } = fixture();
    const globalNpc = { ...structuredClone(live), id: 'global' };
    addPortrait(globalNpc);
    libraries.global.push(globalNpc);
    assert.equal(s.chooseForm(s.resolveNpc(live.name).npc, ''), null);
});
test('server mapping loads with inaccessible IndexedDB and follows replacements', async () => {
    let reads = 0;
    const { sandbox: s, assets } = fixture({ portraitGet: async () => { reads++; throw Error('unavailable'); } });
    assets.id = { path: '/user/files/new.webp' };
    assert.equal(await s.portraitUrl('id'), assets.id.path);
    assets.id.path = '/user/files/replaced.webp';
    assert.equal(await s.portraitUrl('id'), assets.id.path);
    assert.equal(reads, 2);
    assert.equal(await s.portraitUrl('missing'), '');
});
test('unmigrated local image still works and unavailable media can recover on a later attempt', async () => {
    let blob = null;
    const { sandbox: s } = fixture({ portraitGet: async () => blob });
    assert.equal(await s.portraitUrl('id'), '');
    blob = {};
    assert.equal(await s.portraitUrl('id'), 'blob:local');
});
test('rendered messages rehydrate after library edit without reapplying narrative updates', () => {
    let hydrations = 0;
    const element = { classList: { contains: () => true }, innerHTML: '<p>Existing narrative</p>' };
    const { sandbox: s } = fixture({
        getConfig: () => ({ enabled: true }), SillyTavern: { getContext: () => ({ chat: [{}] }) },
        findMessageText: () => element, containsSpeakerMarkup: () => false,
        hydrateChat: target => { assert.equal(target, element); hydrations++; },
        applyNpcUpdates: () => { throw Error('must not replay story updates'); },
    });
    s.renderMessage(0);
    assert.equal(hydrations, 1);
    assert.equal(element.innerHTML, '<p>Existing narrative</p>');
});
test('slow portrait read cannot overwrite a changed form', async () => {
    const { sandbox: s, live } = fixture();
    addPortrait(live);
    let complete;
    s.portraitUrl = () => new Promise(resolve => { complete = resolve; });
    const image = { isConnected: true, src: '' };
    const frame = { classList: { add() {} } };
    const block = { isConnected: true, dataset: { clName: live.name, clForm: '', clPortraitId: 'portrait-new' }, querySelector: selector => selector.endsWith('img') ? image : frame };
    const pending = s.hydrateChatPortrait(block);
    block.dataset.clPortraitId = 'another';
    complete('blob:obsolete');
    await pending;
    assert.equal(image.src, '');
});
test('release assets have new cache keys matching the bundle', () => {
    const manifest = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '../manifest.json')));
    const version = source.match(/CHARACTER_LIFE_BUNDLE_VERSION = '([^']+)'/)[1];
    assert.equal(manifest.version, version);
    assert.equal(manifest.js, 'character-life.js?v=' + version);
    assert.notEqual(version, '1.26.10');
    assert.match(source, /url.searchParams.set\('clv', CHARACTER_LIFE_BUNDLE_VERSION\)/);
});
module.exports = { extract };
