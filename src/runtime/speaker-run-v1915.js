/* Compatibility shim for the consolidated Character Life runtime. */
const url = new URL('../../character-life.js', import.meta.url);
const inherited = new URL(import.meta.url).searchParams.get('clv');
if (inherited) url.searchParams.set('clv', inherited);
await import(url.href);
