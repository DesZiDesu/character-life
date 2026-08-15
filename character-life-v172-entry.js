/* global SillyTavern */

// Character Life v1.9.0 compatibility entry:
// Historical modules remain isolated for safe upgrades; v1.9 adds one cross-chat
// continuity layer and one authoritative release-version layer at the end.
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

try {
    await import('./qol-v183.js');
} catch (error) {
    console.error("[Character Life's] v1.8.3 notifications/bulk-move layer was skipped safely; the core remains loaded.", error);
}

try {
    await import('./npc-profile-builder-v184.js');
} catch (error) {
    console.error("[Character Life's] v1.8.4 sparse-profile/full-builder layer was skipped safely; the core remains loaded.", error);
}

try {
    await import('./continuity-v190.js');
} catch (error) {
    console.error("[Character Life's] v1.9.0 continuity systems were skipped safely; legacy feature layers remain loaded.", error);
}

try {
    await import('./version-sync-v190.js');
} catch (error) {
    console.error("[Character Life's] v1.9.0 version synchronizer was skipped safely; feature layers remain loaded.", error);
}
