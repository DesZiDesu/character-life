# Character Life's

Character Life's is a responsive SillyTavern extension for persistent NPC identities, portraits, speaker presentation, AI-assisted profile updates, cross-chat continuity, and optional skill tracking inside the main role-play chat.

**Current version: 1.9.0**

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
- **Continuity Hub** with cross-chat NPC development, viewpoint-specific knowledge/secrets, relationship history, scene/presence tracking, Chronicle history, advanced skill progression, undo, and diagnostics.

## v1.9 continuity behavior

Character Life now separates **durable continuity** from **temporary scene state**.

Durable state is stored for the current SillyTavern character/group and carries into later chats with that same character/group. This includes lasting NPC personality development, persistent status changes, knowledge and secrets, relationship changes, important Chronicle events, and learned/evolved skills.

Temporary scene state remains attached to the current chat: location, time/day, who is present, current activity, and temporary conditions. By default a new chat starts a fresh scene while retaining durable continuity. The Continuity Hub setting can instead carry the last scene forward.

A one-turn emotion does **not** rewrite an NPC's personality. The continuity protocol only promotes personality changes when the role-play establishes lasting development. Existing chat-scoped NPC profile changes and learned skills are also promoted into the character continuity scope so they are not lost when a new chat is started.

Automatic continuity tracking is included in the normal assistant response through a hidden `[CL_STATE]...[/CL_STATE]` state block. It does not make a second AI generation call.

## Continuity Hub

The Wand menu and Character Life extension settings now expose **Continuity Hub** with these views:

- **Knowledge** — `knows`, `suspects`, `believes`, `secret`, and `misinformation` records per NPC, including confidence and source.
- **Relationships** — trust, fear, hostility, loyalty, respect, attraction, debt, labels, and a reasoned change history.
- **Scene** — current location, time/day, activity, conditions, present NPCs, and absent NPCs.
- **Chronicle** — bounded durable history of important events with people, location, importance, chat ID, and timestamp.
- **Skills+** — proficiency, mastery, use count, cooldown/status, prerequisites, variants/evolutions, teacher/source, learned location/time, and progress history.
- **Diagnostics** — installed release, loaded APIs, storage status, current scope counts, Copy Diagnostic Report, and Undo Last AI State Update.

## Install

1. Open **Extensions** in SillyTavern.
2. Select **Install extension**.
3. Paste `https://github.com/DesZiDesu/character-life`.
4. Reload SillyTavern when prompted.

Open **Character Life's**, **Skill Storage**, or **Continuity Hub** from the Wand menu beside the chat input or from **Extensions → Character Life's**.

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

Character Life processes supported updates and removes its machine-control records from visible chat.

## Storage notes

- Global NPC metadata is available to every bot/chat on the current SillyTavern installation.
- Character NPC metadata is keyed to the current character or group and is the durable continuity scope.
- Chat NPC metadata and scene state are saved only in the current chat.
- Portrait/skill media is handled by Character Life's persistent-media layer.
- Continuity world state is stored in Character Life extension settings under the current character/group key.
- Image analysis can consume quota from the multimodal provider configured in SillyTavern.
- Text-only full-profile generation uses the current SillyTavern chat model.
- Normal continuity tracking does not perform a separate AI call.

## Recent versions

### 1.9.0

- Added cross-chat durable continuity for NPC development and skills.
- Added NPC Knowledge & Secrets with viewpoint-specific truth/belief states.
- Added Relationship Graph metrics and reasoned relationship history.
- Added Scene/Presence tracking with fresh-scene-by-default new-chat behavior.
- Added the NPC Chronicle and in-session Undo Last AI State Update.
- Added advanced skill proficiency/mastery/history metadata while preserving the existing generic Skill Storage.
- Added Continuity Hub diagnostics and Copy Diagnostic Report.
- Added a single hidden state protocol that updates all continuity systems from the normal assistant reply without a second generation call.
- Added authoritative v1.9.0 release synchronization and a v1.9 aggregate stylesheet.

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
