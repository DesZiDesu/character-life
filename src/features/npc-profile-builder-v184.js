/* global SillyTavern */

// Character Life v1.8.4 — sparse NPC facts + one-call full profile builder.
const CL184_VERSION = '1.8.4';
const CL184_PROMPT_KEY = 'character_life_sparse_profile_policy_v184';
const CL184_FIELDS = Object.freeze([
    'name', 'aliases', 'pronouns', 'gender', 'age', 'species', 'role', 'affiliation',
    'appearance', 'personality', 'relationship', 'background', 'goals', 'abilities',
    'speechStyle', 'currentState', 'notes',
]);
const CL184_LIMITS = Object.freeze({
    name: 120, aliases: 500, pronouns: 100, gender: 100, age: 100, species: 120,
    role: 160, affiliation: 160, appearance: 4000, personality: 3000,
    relationship: 3000, background: 4000, goals: 2500, abilities: 3000,
    speechStyle: 2000, currentState: 2000, notes: 2000, adultAppearance: 4000,
});
let cl184Observer = null;
let cl184PromptTimer = null;

const cl184Ctx = () => globalThis.SillyTavern?.getContext?.() || null;
const cl184Text = (value, fallback = '', max = 4000) =>
    typeof value === 'string' ? value.trim().slice(0, max) : fallback;

function cl184Escape(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function cl184Notify(type, message) {
    if (globalThis.toastr && typeof globalThis.toastr[type] === 'function') {
        globalThis.toastr[type](message, "Character Life's");
    } else {
        console[type === 'error' ? 'error' : 'info'](`[Character Life's] ${message}`);
    }
}

function cl184HasChat() {
    return Boolean(cl184Ctx()?.getCurrentChatId?.());
}

function cl184UpdateSparsePrompt() {
    cl184PromptTimer = null;
    const context = cl184Ctx();
    if (!context?.setExtensionPrompt) return;
    if (!cl184HasChat()) {
        context.setExtensionPrompt(CL184_PROMPT_KEY, '', 1, 1, false, 0);
        return;
    }
    context.setExtensionPrompt(
        CL184_PROMPT_KEY,
        `CHARACTER LIFE — SPARSE NPC FACT POLICY v${CL184_VERSION}
NPC profile fields are optional knowledge, not a checklist.
When an NPC is known only by name, keep every unknown field empty. Do not infer or fabricate age, gender, pronouns, species, role, affiliation, appearance, personality, relationship, background, goals, abilities, speech style, current state, or notes merely because the field exists.
Automatic [CL_NPC_UPDATE] tags may only record facts actually established by the character card, lorebook, world info, or conversation. Appearance alone must not be used to guess exact age, gender identity, ethnicity, nationality, personality, health, or background.
An empty field is valid and should remain empty indefinitely until the information becomes established.
The only exception is an explicit user request to invent/complete a profile, including an OOC instruction or use of Character Life's Generate Full NPC button. In that explicit creation mode, creative completion is allowed while respecting facts already supplied by the user.`,
        1, 1, false, 0,
    );
}

function cl184SchedulePrompt(delay = 60) {
    clearTimeout(cl184PromptTimer);
    cl184PromptTimer = setTimeout(cl184UpdateSparsePrompt, delay);
}

function cl184PanelHtml() {
    return `<section class="cl-editor-section wide cl-full-profile-builder" data-cl184-builder>
        <header><i class="fa-solid fa-user-pen"></i><span>AI Profile Builder</span><b>1 AI CALL</b></header>
        <div class="cl-full-profile-intro">
            <strong>Generate the whole NPC at once</strong>
            <p>Leave unknown NPC fields blank during normal role-play. Use this only when you explicitly want Character Life to invent or complete a full profile.</p>
        </div>
        <label class="wide cl-builder-concept">
            <span>Character concept / instructions</span>
            <textarea data-cl184-concept rows="4" maxlength="5000" placeholder="Example: A reserved guild receptionist who secretly used to be an A-rank hunter. Keep her professional, observant, and difficult to impress."></textarea>
        </label>
        <div class="cl-builder-grid">
            <label><span>Fill behavior</span><select data-cl184-fill-mode>
                <option value="empty">Fill empty fields only</option>
                <option value="all">Regenerate all fields</option>
            </select></label>
            <label><span>Image interpretation</span><select data-cl184-image-mode>
                <option value="full">Full appearance</option>
                <option value="key">Key permanent features</option>
            </select></label>
            <label class="cl-builder-image"><span>Optional reference image</span><input data-cl184-image type="file" accept="image/*"></label>
        </div>
        <div class="cl-builder-actions">
            <small data-cl184-status>Text-only generation uses SillyTavern's current chat model. With an image, the configured multimodal caption model generates the complete profile in one call.</small>
            <button type="button" class="cl-primary" data-cl184-generate><i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate Full NPC</span></button>
        </div>
    </section>`;
}

function cl184EnsureBuilder(form) {
    if (!(form instanceof HTMLFormElement) || form.querySelector('[data-cl184-builder]')) return;
    const sections = form.querySelectorAll('.cl-editor-section');
    const identity = sections[0];
    if (identity) identity.insertAdjacentHTML('afterend', cl184PanelHtml());
    else form.insertAdjacentHTML('afterbegin', cl184PanelHtml());
}

function cl184PatchEditors(root = document) {
    const forms = [];
    if (root instanceof Element && root.matches?.('form[data-form="npc"]')) forms.push(root);
    for (const form of root.querySelectorAll?.('form[data-form="npc"]') || []) forms.push(form);
    for (const form of forms) cl184EnsureBuilder(form);
}

function cl184Draft(form) {
    const lines = [];
    for (const field of CL184_FIELDS) {
        const control = form.elements[field];
        if (!control) continue;
        const value = cl184Text(control.value, '', CL184_LIMITS[field] || 4000).replace(/\s+/g, ' ');
        if (value) lines.push(`${field}: ${value}`);
    }
    if (form.elements.adultProfile?.checked) {
        const adult = cl184Text(form.elements.adultAppearance?.value, '', 4000).replace(/\s+/g, ' ');
        if (adult) lines.push(`adultAppearance: ${adult}`);
    }
    return lines.join('\n');
}

function cl184MinorAge(value) {
    const text = cl184Text(value, '', 100).toLowerCase();
    if (!text) return false;
    if (/\b(child|minor|underage)\b|เด็ก|เยาวชน/i.test(text)) return true;
    const ages = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
    return ages.some(age => age >= 0 && age < 18);
}

function cl184Schema(includeAdult = false) {
    const schema = {
        name: '', aliases: '', pronouns: '', gender: '', age: '', species: '',
        role: '', affiliation: '', appearance: '', personality: '', relationship: '',
        background: '', goals: '', abilities: '', speechStyle: '', currentState: '', notes: '',
    };
    if (includeAdult) schema.adultAppearance = '';
    return JSON.stringify(schema, null, 2);
}

function cl184GenerationPrompt(form, concept, imageMode, includeAdult) {
    const existing = cl184Draft(form) || '(no existing facts)';
    const imageInstruction = imageMode === 'key'
        ? 'Use the image only for enduring physical traits. Ignore pose, background, temporary lighting, and carried objects unless the user explicitly makes them permanent.'
        : 'Use the image as the visual reference for appearance, including visible clothing/accessories when useful, but do not identify a real person or infer sensitive traits.';
    const adultRule = includeAdult
        ? 'The user explicitly enabled the adult profile for this fictional adult NPC. adultAppearance may contain a direct adult physical/anatomical description, but no sexual acts or coercion.'
        : 'Do not produce explicit sexual anatomy. Do not add an adultAppearance key.';
    return `CHARACTER LIFE — ONE-CALL FULL NPC BUILDER
The user explicitly requested creative profile completion. Create one coherent fictional NPC profile using the user's concept, existing draft facts, current SillyTavern conversation/lore context, and the reference image when supplied.
Preserve established facts. Do not contradict the draft or conversation. Creative invention is allowed for missing fields because this button is an explicit generation request.
${imageInstruction}
${adultRule}

Return ONLY valid JSON matching this exact key set. Every value must be a string. No markdown, code fence, comments, or extra keys.
Aliases must be a comma-separated string. Keep fields concise but useful for role-play. Do not put "unknown", "N/A", or placeholders into a field: if the user's instructions make a field intentionally unknowable, return an empty string.

SCHEMA:
${cl184Schema(includeAdult)}

USER CONCEPT / INSTRUCTIONS:
${concept || '(no additional concept; complete from existing facts and context)'}

EXISTING NPC DRAFT — facts here take priority:
${existing}`;
}

function cl184ExtractJson(raw) {
    let text = cl184Text(raw, '', 30000);
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('The AI did not return a JSON profile.');
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The AI returned an invalid profile.');
    return parsed;
}

function cl184SetField(form, field, value, fillMode) {
    const control = form.elements[field];
    if (!control) return false;
    if (fillMode === 'empty' && cl184Text(control.value, '', 10)) return false;
    const next = cl184Text(typeof value === 'string' ? value : '', '', CL184_LIMITS[field] || 4000);
    if (!next) return false;
    control.value = next;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

async function cl184FileToDataUrl(file) {
    if (!(file instanceof File)) return '';
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Image is larger than 20 MB.');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read the image.'));
        reader.readAsDataURL(file);
    });
}

async function cl184Generate(form, panel) {
    const button = panel.querySelector('[data-cl184-generate]');
    const status = panel.querySelector('[data-cl184-status]');
    const concept = cl184Text(panel.querySelector('[data-cl184-concept]')?.value, '', 5000);
    const fillMode = panel.querySelector('[data-cl184-fill-mode]')?.value === 'all' ? 'all' : 'empty';
    const imageMode = panel.querySelector('[data-cl184-image-mode]')?.value === 'key' ? 'key' : 'full';
    const image = panel.querySelector('[data-cl184-image]')?.files?.[0] || null;
    const adultEnabled = Boolean(form.elements.adultProfile?.checked);
    const includeAdult = adultEnabled && !cl184MinorAge(form.elements.age?.value);
    if (adultEnabled && !includeAdult) throw new Error('Adult profile generation is blocked because the age field identifies this NPC as a minor.');

    const prompt = cl184GenerationPrompt(form, concept, imageMode, includeAdult);
    button.disabled = true;
    button.classList.add('is-working');
    if (status) status.textContent = image ? 'Generating full NPC from image + instructions…' : 'Generating full NPC from instructions + chat context…';

    try {
        let raw = '';
        if (image) {
            const source = await cl184FileToDataUrl(image);
            const shared = await import('/scripts/extensions/shared.js');
            if (typeof shared.getMultimodalCaption !== 'function') throw new Error('SillyTavern multimodal captioning is unavailable.');
            raw = await shared.getMultimodalCaption(source, prompt);
        } else {
            const generator = cl184Ctx()?.generateQuietPrompt;
            if (typeof generator !== 'function') throw new Error('This SillyTavern build does not expose quiet AI generation to extensions.');
            raw = await generator(prompt);
        }

        const profile = cl184ExtractJson(raw);
        let changed = 0;
        for (const field of CL184_FIELDS) {
            if (cl184SetField(form, field, profile[field], fillMode)) changed += 1;
        }
        if (includeAdult && cl184SetField(form, 'adultAppearance', profile.adultAppearance, fillMode)) changed += 1;
        if (!changed) {
            if (status) status.textContent = 'No fields changed. Existing values were preserved.';
            cl184Notify('info', 'Full NPC generation finished; no empty fields needed changes.');
            return;
        }
        if (status) status.textContent = `Generated ${changed} field${changed === 1 ? '' : 's'}. Review the profile, then save the NPC.`;
        cl184Notify('success', `Full NPC generated in one AI call (${changed} fields).`);
        form.elements.name?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
        if (status) status.textContent = `Generation failed: ${error.message}`;
        throw error;
    } finally {
        button.disabled = false;
        button.classList.remove('is-working');
    }
}

function cl184BindClicks() {
    document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-cl184-generate]');
        if (!button) return;
        const panel = button.closest('[data-cl184-builder]');
        const form = button.closest('form[data-form="npc"]');
        if (!panel || !form) return;
        void cl184Generate(form, panel).catch(error => cl184Notify('error', error.message));
    });
}

function cl184BindEvents() {
    const context = cl184Ctx();
    const source = context?.eventSource;
    const types = context?.eventTypes || {};
    if (!source?.on) return;
    const seen = new Set();
    for (const key of ['CHAT_CHANGED', 'CHAT_LOADED', 'MESSAGE_RECEIVED']) {
        const type = types[key];
        if (!type || seen.has(type)) continue;
        seen.add(type);
        source.on(type, () => cl184SchedulePrompt(80));
    }
}

function cl184Init() {
    cl184UpdateSparsePrompt();
    cl184PatchEditors(document);
    cl184BindClicks();
    cl184BindEvents();
    cl184Observer = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node instanceof Element) cl184PatchEditors(node);
            }
        }
    });
    cl184Observer.observe(document.body, { childList: true, subtree: true });
    document.documentElement.dataset.clProfileBuilder = CL184_VERSION;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cl184Init, { once: true });
else cl184Init();
