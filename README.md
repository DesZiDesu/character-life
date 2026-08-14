# Character Life's

Character Life's is a responsive SillyTavern extension that stores NPC identities and local portraits, then turns structured speaker tags into Chronicle-style thought, header, and dialogue panels inside the main chat.

## Features

- Global, per-character (bot), and per-chat NPC libraries.
- Scope priority: Chat → Character → Global.
- Multiple local portraits/forms for every NPC (outfits, transformations, ages, disguises, expressions, and more).
- Active/default form selection plus per-image X/Y framing and zoom.
- Images are compressed and stored locally in IndexedDB; no Catbox, GitHub image upload, or external image host is required.
- NPC metadata remains in SillyTavern extension settings or chat metadata according to its selected scope.
- Rich AI-readable profiles: pronouns, age, species, appearance, personality, relationships, background, goals, abilities, speech style, and current state.
- Optional hidden profile-update tags let the active model save newly established NPC facts back into the correct library scope.
- AI Appearance Reader uses SillyTavern's configured multimodal Image Captioning model with Full Appearance and clothing-independent Key Features modes.
- Wand-menu launcher, Extension Settings drawer, and responsive NPC manager.
- Chronicle Signature and Chronicle Imperial designs, switchable in Settings.
- Left, middle, or right speaker alignment. Thought and dialogue automatically follow the header.
- Adjustable portrait size, shape, missing-image behavior, and independent header/thought/dialogue colors.
- English and Thai interface.
- Chat renderer for Character Life tags and the existing Chronicle `[THINK]`, `[CHAR]`, `[NPC]`, and `[SAY]` formats.
- Optional prompt injection that teaches the current bot to emit the correct order: thought → header → dialogue.
- Optional chat-scoped placeholder discovery when an unknown tagged NPC appears.
- Import/export backup for NPC metadata and portrait images.

## Install

1. Open **Extensions** in SillyTavern.
2. Select **Install extension**.
3. Paste:

   `https://github.com/DesZiDesu/character-life`

4. Reload SillyTavern when prompted.

Open **Character Life's** from the Wand menu beside the chat input or from **Extensions → Character Life's**.

## Speaker tags

```text
[CL_THOUGHT|Roxy|school-uniform]I recognize that seal.[/CL_THOUGHT]
[CL_HEADER|Roxy|school-uniform]
[CL_DIALOGUE|Roxy|school-uniform]Do not touch it yet.[/CL_DIALOGUE]
```

The portrait form is optional. If it is omitted, the NPC's active form is used. Dialogue numbering is created by the extension and does not need to be written by the model.

One header can contain several dialogue blocks from the same speaker with ordinary narration between them. A new header is needed when the active speaker changes.

When automatic profile updates are enabled, the model may append hidden updates such as:

```text
[CL_NPC_UPDATE|Roxy|relationship]She now trusts the user with restricted research notes.[/CL_NPC_UPDATE]
```

Character Life's removes this tag from the visible reply and saves the supported field to the resolved NPC scope. Updates are limited to facts established in the conversation or saved profile.

Existing Chronicle formats are also recognized:

```text
[THINK|Roxy|#a96f7c|I recognize that seal.]
[CHAR|any-value|Roxy|#c39a62]
[NPC|Unknown Guard|#c39a62|Royal Watch]
[SAY|Roxy|#7792bd|Do not touch it yet.]
```

When Character Life's renders the chat itself, disable overlapping Header/Monologue/Dialogue regex scripts for the same tags to avoid two formatters styling the same message.

## Storage notes

- Global NPC metadata is available to every bot and chat on the current SillyTavern installation.
- Character NPC metadata is keyed to the current character or group.
- Chat NPC metadata is saved only in the current chat.
- Portrait bytes stay on the current browser/device. Use **Export backup** to move them to another device.
- The AI Appearance Reader sends the selected image to the multimodal provider configured under SillyTavern's Image Captioning settings. This can use that provider's API quota. The generated description is shown for review and is not saved until **Save NPC** is pressed.

## Version

### 1.1.0

- Added detailed AI-readable NPC records and searchable profile fields.
- Added automatic chat-derived NPC profile updates with a settings toggle and hidden update protocol.
- Added two-mode multimodal appearance analysis for uploaded references or existing local portraits.
- Expanded the speaker prompt to explicitly support multiple dialogue blocks and narration under one header.

### 1.0.0

- Initial Character Life's release.
- Added three-scope NPC storage, multiple local portrait forms, responsive manager, backup import/export, prompt protocol, Chronicle compatibility, and both approved Chronicle chat designs.
