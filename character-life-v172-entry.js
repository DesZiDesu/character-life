/* global SillyTavern */

// Character Life v1.8.2 compatibility entry:
// 1) load the recovered Character Life core first;
// 2) add the explicit settings-save hook used by safe transfer/media layers;
// 3) load each optional layer behind its own catch so one failure cannot block the core;
// 4) apply the Skill Storage layer;
// 5) apply the v1.8.2 unified-color + main-chat NPC profile director last.
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
    console.error("[Character Life's] Wand enhancer was skipped safely; the recovered Character Life core remains loaded.", error);
}

try {
    await import('./skill-system-v172.js');
} catch (error) {
    console.error("[Character Life's] Skill Indication system was skipped safely; the recovered Character Life core remains loaded.", error);
}

try {
    await import('./skill-optional-v172.js');
} catch (error) {
    console.error("[Character Life's] Per-chat Skill Indicator switch was skipped safely; the core remains loaded.", error);
}

try {
    await import('./skill-storage-v181.js');
} catch (error) {
    console.error("[Character Life's] Skill Storage presentation layer was skipped safely; the core remains loaded.", error);
}

try {
    await import('./npc-intelligence-v182.js');
} catch (error) {
    console.error("[Character Life's] v1.8.2 NPC identity/profile director was skipped safely; the core remains loaded.", error);
}
