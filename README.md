# Character Life's

Character Life's is a responsive SillyTavern extension for persistent NPC identities, portraits, speaker presentation, AI-assisted profile updates, and optional skill tracking inside the main role-play chat.

**Current version: 1.26.4**

- v1.26.4 binds the active SillyTavern persona name into the unified role-play protocol, refreshes the protocol synchronously when a message/generation starts, and consumes profile updates from the raw assistant message before rendering or cleanup can remove them.

- v1.26.3 keeps the NPC candidate approval dialog inside the live iOS visual viewport across Safari toolbar, keyboard, safe-area, rotation, and zoom changes.

## Highlights

- Global, per-character/group, and per-chat NPC libraries with Chat → Character → Global priority.
- Automatic same-character/group carry-over moves chat NPCs, AI overrides, relationships, partner links, Skill Storage, and the per-chat skill switch into a new chat.
- Chat-local AI overrides stay visually attached to their Global/Character source; the Chat tab lists only genuinely chat-scoped NPCs instead of duplicate source records.
- Rich NPC profiles with sparse/unknown fields, aliases, portraits/forms, framing controls, and bulk scope movement.
- One-call **Generate Full NPC** workflow with optional image reference and multimodal appearance guidance.
- Chronicle-style Thought, Header, and Dialogue rendering with seven built-in designs plus an independent theme creator.
- Main-chat NPC profile updates, stable NPC identity colors, native Character Life notifications, and responsive mobile/desktop UI.
- Compact SVG backup controls stay beside the close button in the Characters header on desktop and mobile. Full backups use a low-memory ZIP with raw portrait files to prevent large iOS/Safari libraries from being duplicated as base64 in RAM; legacy JSON backups remain importable.
- Quota-optimized prompts prioritize recent, chat-local, incomplete, partnered, and lifecycle-relevant NPCs; Settings count every separate AI helper or vision request started by Character Life.
- Saved NPC records keep a readable identity minimum; unsaved speakers retain only facts actually established in the role-play until the user approves promotion.
- Unknown tagged speakers now remain ephemeral: Character Life scores repeated appearances, durable roles, meaningful interaction, and distinct traits locally, then asks Yes/No before saving an important candidate to Chat scope. Rejected candidates wait at least 20 assistant messages and require two new evidence signals before they can be suggested again.
- NPCs can be enabled or disabled in Global and Character scopes without deleting their original data; death and revive controls are visible in the profile.
- Each NPC can keep a short relationship-to-user label, while Partner links can connect NPCs from Global, Character, or Chat to each other or to the user. Partner links are chat-local and can be carried through a backup.
- Dedicated Skill Storage with persistent images, optional AI tracking, per-chat enable state, and a Tensei System bridge.
- Tretaresia RPG bridge for scoped NPC identity lookup, portrait/form reuse, and shared Skill Storage data without an additional model request.
- World-map portraits are generated as real 64px WebP thumbnails only when requested, kept in a 40-entry LRU cache, and expose initials/clustering fallback guidance when marker density is high.
- English and Thai interface support.

## Extensions drawer

Character Life's settings are organized into collapsible sections instead of placing every feature in one continuous page. The drawer shows a single release version at the top; historical feature-layer versions are implementation details and are not shown as separate extension versions.

The main sections are:

- **NPC & AI behavior** — speaker protocol, discovery, profile updates, and unified NPC colors.
- **Appearance & chat layout** — design, position, portraits, spacing, language, and fallback colors.
- **Skill Storage** — indicators, tracking, design, and per-chat enable state.
- **Notifications & Library Tools** — Character Life notifications and bulk NPC movement.
- **Independent Theme Creator** — custom Header, Monologue, and Dialogue design.
- **Speaker tag reference** — advanced tag reference.

Each section remembers whether it was open or closed on that browser.

## Compatibility

Character Life uses its own `character_life` settings/metadata namespace and its own prompt keys. It is designed to coexist with other SillyTavern extensions rather than overwrite their storage.

- **Tensei System:** intentionally supported. Character Life can read Tensei's `tensei_system_state` and bridge skill information into Skill Storage.
- **Tretaresia RPG System:** intentionally supported. RPG NPCs can link to Character Life by stable ID/scope or exact name/alias, reuse the active portrait and framing, read Skill Storage entries, and write RPG-tracked skills back through the local Character Life API.
- **Start New Chat With Summary:** intentionally supported. Character Life captures its own chat metadata before the Nutho extension starts a new chat, restores it after `CHAT_CHANGED`, and leaves the summary/memory metadata untouched.
- **Pocket Phone Optimized:** no shared Character Life storage namespace. Both extensions can add structured main-response instructions, so very large combined prompts can increase formatting/token pressure even though they do not directly overwrite each other.
- **Smart Memory Optimized:** long-term memory is handled by the separate Smart Memory Optimized extension rather than Character Life.

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

Character Life 1.17 adds immutable Original profile snapshots for Global and Character NPCs. AI profile updates are stored as chat-local overrides, so a new chat starts from the saved Original data. NPC life status is also tracked: dead Chat NPC records are removed, while Global and Character records are visibly marked dead and can be revived from their detail view or through the role-play status protocol.

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

Character Life processes its supported machine-control records and removes them from visible chat, including compact `CL_NPC_UPDATE` fallbacks emitted by models.

## Storage notes

- Global NPC metadata is available across chats on the current SillyTavern installation.
- Character NPC metadata is keyed to the current character/group.
- Chat NPC metadata belongs to its chat and is also cached per character/group when automatic continuity is enabled, allowing a new chat to inherit it.
- Portrait and skill media are handled by Character Life's persistent-media layer.
- Character Life does not require a separate API key; it uses SillyTavern's configured generation/caption capabilities when AI assistance is requested.


## RPG compatibility

- Bridge v2 accepts RPG System v0.14 NPC dossier updates in the same normal reply, safely localizes them to the active chat, preserves protected original records, and synchronizes relationship, current activity/location, abilities, and missing identity fields without another model request.
