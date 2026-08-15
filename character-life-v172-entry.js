/* global SillyTavern */

// Safety-first v1.7.2 entry:
// 1) load the recovered Character Life core first;
// 2) add an explicit settings-save hook used only by the transfer layer;
// 3) enable raw CL_NPC_UPDATE cleanup behind its own safety catch;
// 4) load the Wand enhancer behind a catch so optional layers cannot block the core.
import './theme-studio-v171.js';

try {
    const saver = globalThis.SillyTavern?.getContext?.()?.saveSettingsDebounced;
    if (typeof saver === 'function' && typeof saver.flush !== 'function') {
        Object.defineProperty(saver, 'flush', {
            configurable: true,
            value: async () => {
                const module = await import('/script.js');
                if (typeof module.saveSettings !== 'function') throw new Error('SillyTavern saveSettings() is unavailable.');
                return module.saveSettings();
            },
        });
    }

    try {
        await import('./npc-update-cleaner-v172.js');
    } catch (error) {
        console.error("[Character Life's] Raw NPC update cleanup was skipped safely; the core remains loaded.", error);
    }

    await import('./character-life-v172.js');
} catch (error) {
    console.error("[Character Life's] v1.7.2 Wand enhancer was skipped safely; the recovered Character Life core remains loaded.", error);
}
