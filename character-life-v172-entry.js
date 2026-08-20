/* Compatibility entry for cached Character Life installs. */
const url = new URL('./character-life.js', import.meta.url);
const inherited = new URL(import.meta.url).searchParams.get('clv');
if (inherited) url.searchParams.set('clv', inherited);
await import(url.href);
