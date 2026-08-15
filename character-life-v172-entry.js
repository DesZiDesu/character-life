// Compatibility shim for Character Life installs whose cached v1.9.3 bootstrap
// still requests the historical root runtime path. Runtime code now lives in src/.
const url = new URL('./src/runtime/entry.js', import.meta.url);
const inherited = new URL(import.meta.url).searchParams.get('clv');
if (inherited) url.searchParams.set('clv', inherited);
await import(url.href);
