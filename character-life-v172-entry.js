/* global SillyTavern */

// Safety-first v1.7.2 entry:
// 1) load the recovered Character Life core first;
// 2) add the explicit settings-save hook used by safe transfer/media layers;
// 3) load each optional layer behind its own catch so one failure cannot block the core.
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
} catch (error) {
    console.error("[Character Life's] Immediate settings-save hook was skipped safely.", error);
}

try {
    await import('./npc-update-cleaner-v172.js');
} catch (error) {
    console.error("[Character Life's] Raw NPC update cleanup was skipped safely; the core remains loaded.", error);
}

try {
    await import('./persistent-media-v172.js');
} catch (error) {
    console.error("[Character Life's] Persistent media layer was skipped safely; the core remains loaded.", error);
}

try {
    await import('./character-life-v172.js');
} catch (error) {
    console.error("[Character Life's] v1.7.2 Wand enhancer was skipped safely; the recovered Character Life core remains loaded.", error);
}

try {
    await import('./skill-system-v172.js');
} catch (error) {
    console.error("[Character Life's] Skill Indication system was skipped safely; the recovered Character Life core remains loaded.", error);
}
