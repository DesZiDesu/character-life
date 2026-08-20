# Character Life's

Character Life's is a responsive SillyTavern extension for persistent NPC identities, portraits, speaker presentation, AI-assisted profile updates, cross-chat continuity, and optional skill tracking inside the main role-play chat.

**Current version: 1.13.1**

## Highlights

- Global, per-character/group, and per-chat NPC libraries with Chat → Character → Global priority.
- Rich NPC profiles with sparse/unknown fields, aliases, portraits/forms, framing controls, and bulk scope movement.
- One-call **Generate Full NPC** workflow with optional image reference and multimodal appearance guidance.
- Chronicle-style Thought, Header, and Dialogue rendering with seven built-in designs plus an independent theme creator.
- Main-chat NPC profile updates, stable NPC identity colors, native Character Life notifications, and responsive mobile/desktop UI.
- Dedicated Skill Storage with persistent images, optional AI tracking, per-chat enable state, and a Tensei System bridge.
- **Continuity Hub** for lasting NPC development, knowledge/secrets, relationships, scene/presence, Chronicle history, advanced skill progression, undo, and diagnostics.
- English and Thai interface support.

## Extensions drawer

Character Life's settings are organized into collapsible sections instead of placing every feature in one continuous page. The drawer shows a single release version at the top; historical feature-layer versions are implementation details and are not shown as separate extension versions.

The main sections are:

- **NPC & AI behavior** — speaker protocol, discovery, profile updates, and unified NPC colors.
- **Appearance & chat layout** — design, position, portraits, spacing, language, and fallback colors.
- **Skill Storage** — indicators, tracking, design, and per-chat enable state.
- **Continuity Hub** — cross-chat state and continuity controls.
- **Notifications & Library Tools** — Character Life notifications and bulk NPC movement.
- **Independent Theme Creator** — custom Header, Monologue, and Dialogue design.
- **Speaker tag reference** — advanced tag reference.

Each section remembers whether it was open or closed on that browser.

## Continuity behavior

Character Life separates **durable continuity** from **temporary scene state**.

Durable state is stored for the current SillyTavern character/group and can carry into later chats with that same character/group. This includes lasting NPC personality development, persistent status changes, knowledge/secrets, relationship changes, important Chronicle events, and learned/evolved skills.

Temporary scene state remains attached to the current chat: location, time/day, who is present, current activity, and temporary conditions. By default a new chat starts a fresh scene while retaining durable continuity. A short-lived emotion does not automatically rewrite an NPC's lasting personality.

Automatic continuity tracking is included in the normal assistant response through Character Life's hidden state protocol; it does not require a second AI generation solely for the continuity update.

## Compatibility

Character Life uses its own `character_life` settings/metadata namespace and its own prompt keys. It is designed to coexist with other SillyTavern extensions rather than overwrite their storage.

- **Tensei System:** intentionally supported. Character Life can read Tensei's `tensei_system_state` and bridge skill information into Skill Storage.
- **Pocket Phone Optimized:** no shared Character Life storage namespace. Both extensions can add structured main-response instructions, so very large combined prompts can increase formatting/token pressure even though they do not directly overwrite each other.
- **Smart Memory Optimized:** no direct storage/prompt-key collision, but there is intentional functional overlap around long-term facts, relationships, epistemic knowledge, profiles, scenes, and continuity. If both systems track the same facts automatically, treat one as the primary source of truth to avoid duplicated context or contradictory parallel records.

## Repository layout

Runtime implementation is kept out of the repository root:

```text
character-life/
├── bootstrap.js                 # stable cache-safe loader
├── manifest.json                # single release-version source
├── settings.html                # Extensions drawer template
├── character-life-v172-entry.js # tiny migration shim for cached v1.9.3 installs
├── style-v190.css               # tiny migration shim for cached v1.9.3 installs
├── src/
│   ├── runtime/
│   │   └── entry.js
│   ├── core/
│   │   ├── index.js
│   │   ├── design-studio.js
│   │   └── theme-studio-v171.js
│   └── features/
│       └── ...feature modules...
└── styles/
    ├── settings.css
    └── ...presentation layers...
```

The repository now ships one consolidated runtime (character-life.js) and one consolidated stylesheet (character-life.css). Small compatibility shims remain at historical paths so cached iOS/Safari installations can transition without changing the UI or losing saved data. The installed release version comes only from manifest.json.

## Cache-safe updates

The consolidated runtime owns cache busting for both the JavaScript bundle and stylesheet. It also uses a global load sentinel so an old cached bootstrap or duplicate import cannot initialize Character Life twice.

## Install

1. Open **Extensions** in SillyTavern.
2. Select **Install extension**.
3. Paste `https://github.com/DesZiDesu/character-life`.
4. Reload SillyTavern when prompted.

## Speaker tags

```text
[CL_THOUGHT|Avery|field-uniform]I recognize that seal.[/CL_THOUGHT]
[CL_HEADER|Avery|field-uniform]
[CL_DIALOGUE|Avery|field-uniform]Do not touch it yet.[/CL_DIALOGUE]
```

The portrait form is optional. Automatic profile updates may also use Character Life machine-control records such as:

```text
[CL_NPC_UPDATE|Avery|relationship]They now trust the user with restricted research notes.[/CL_NPC_UPDATE]
```

Character Life processes its supported machine-control records and removes them from visible chat.

## Storage notes

- Global NPC metadata is available across chats on the current SillyTavern installation.
- Character NPC metadata and durable continuity are keyed to the current character/group.
- Chat NPC metadata and temporary scene state are saved only in the current chat.
- Portrait and skill media are handled by Character Life's persistent-media layer.
- Character Life does not require a separate API key; it uses SillyTavern's configured generation/caption capabilities when AI assistance is requested.
