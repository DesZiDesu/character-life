// Character Life v1.9.7 compatibility shim.
//
// The historical Wand enhancer imports ./theme-studio-v171.js from the
// features directory. The actual theme studio is loaded first from src/core by
// runtime/entry.js, so this module intentionally does not import it a second
// time. Its presence lets the Wand enhancer finish evaluating instead of being
// skipped because of a missing relative module.
export {};
