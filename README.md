# Character Life's

Character Life's is a responsive SillyTavern extension for persistent NPC identities, portraits, speaker presentation, AI-assisted profile updates, and optional skill tracking inside the main role-play chat.

**Current version: 1.8.6**

## Current features

- Global, per-character/group, and per-chat NPC libraries with Chat → Character → Global priority.
- Rich NPC profiles, aliases, multiple portrait/forms, framing/zoom controls, and scope copy/move tools.
- Persistent portrait and skill media through SillyTavern storage with IndexedDB used as a local cache/fallback.
- Optional chat-derived NPC profile updates that record only facts established by the card, lore, world info, or conversation.
- Sparse-profile policy: unknown NPC fields may remain empty instead of being invented automatically.
- One-call **Generate Full NPC** workflow for explicit character creation/completion.
- AI Appearance Reader and field assistance through SillyTavern's configured models.
- Chronicle-style Thought, Header, and Dialogue rendering plus compatibility with `[THINK]`, `[CHAR]`, `[NPC]`, and `[SAY]`.
- Seven built-in presentation designs plus an independent custom Header/Monologue/Dialogue theme creator.
- English and Thai interface support.
- Dedicated Skill Storage with Global, Character, and Chat scopes, persistent skill images, optional AI tracking, and a per-chat master switch.
- Character Life native notifications and bulk NPC scope movement.
- Responsive desktop/mobile interfaces.

## Install

1. Open **Extensions** in SillyTavern.
2. Select **Install extension**.
3. Paste `https://github.com/DesZiDesu/character-life`.
4. Reload SillyTavern when prompted.

Open **Character Life's** from the Wand menu beside the chat input or from **Extensions → Character Life's**.

## Speaker tags

```text
[CL_THOUGHT|Avery|field-uniform]I recognize that seal.[/CL_THOUGHT]
[CL_HEADER|Avery|field-uniform]
[CL_DIALOGUE|Avery|field-uniform]Do not touch it yet.[/CL_DIALOGUE]
```

The portrait form is optional. If omitted, the NPC's active form is used. A new header is needed when the active speaker changes.

Automatic profile updates may use machine-control records such as:

```text
[CL_NPC_UPDATE|Avery|relationship]They now trust the user with restricted research notes.[/CL_NPC_UPDATE]
```

Character Life processes supported updates and removes its machine-control record from the visible/stored reply.

## Storage notes

- Global NPC metadata is available to every bot/chat on the current SillyTavern installation.
- Character NPC metadata is keyed to the current character or group.
- Chat NPC metadata is saved only in the current chat.
- Portrait/skill media is handled by Character Life's persistent-media layer.
- Image analysis can consume quota from the multimodal provider configured in SillyTavern.
- Text-only full-profile generation uses the current SillyTavern chat model.

## Recent versions

### 1.8.6

- Added an authoritative final version-synchronization layer.
- Prevented historical feature modules from overwriting the current Extension Settings and Skill Storage version badges.
- Synchronized the manifest and public extension-level version reporting.

### 1.8.5

- Fixed the per-chat Skill Indicator master switch so OFF persists correctly instead of being reset during click/change event ordering.

### 1.8.4

- Added sparse NPC facts and the one-call full NPC profile builder.

### 1.8.3

- Added native notifications and bulk NPC scope movement.

### 1.8.2

- Added NPC identity/profile intelligence, aliases, and unified identity colors.

### 1.8.1

- Added the dedicated Skill Storage presentation/settings layer and separate Wand launcher.

### 1.8.0

- Added the refined Wand navigation and independent theme-creator workflow.

### 1.7.2

- Added the safe Wand enhancer, persistent media, generic Skill Indication engine, and NPC-update cleanup compatibility layers.
