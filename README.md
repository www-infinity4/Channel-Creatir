# Channel Creatir

Channel Creatir is the Infinity TV channel factory.

Describe a station in plain language, review the generated channel package, then deploy it into a GitHub repository from the page.

## Required scaffold on every generated channel

Every new channel is generated as part of the shared Infinity TV network, not as a standalone menu copy. The page loads **Control Phi** directly and receives the canonical channel registry from `Control-Phi/channels.json`.

The shared scaffold provides:

- a **☰ Channels** hamburger populated from the central Control Phi registry;
- the Nintendo/Ozzy-style live guide with channel artwork, channel name, and current program title;
- **Omni TV**, **News Phi**, and **Infinity Phi** navigation;
- an Infinity Phi **Search the web** field;
- the shared StarCoin wallet/share hook;
- News Phi interest signals from completed shares;
- Cosmo and the shared live-network guide supplied by Control Phi.

A new channel must therefore be added to the central Control Phi registry instead of hard-coding a second channel list inside the new repository.

## What it generates

- synchronized live channel page
- deterministic local-time schedule
- fresh-deck scheduling: each verified program is used once before reuse
- duplicate-ID rejection and automatic failed-source quarantine
- deployment coverage gate requiring enough unique programs for every daily slot
- daily / weekly / rolling rotation modes
- full-program YouTube catalog file
- intermission space for future advertising
- TV guide and next-program cards
- start over, rewind, and join-live controls
- share control and shared StarCoin network hook
- Control Phi shared channel remote and live guide
- channel manifest
- social-preview artwork scaffold
- GitHub Pages-ready `.nojekyll`

## GitHub deployer

Open the **GitHub deployment** section in the page and enter a GitHub token with permission to create/update the target repository. The token is held only in the active browser page and is not written to localStorage or committed into generated files.

Creatir will:

1. use the requested repository if it exists;
2. attempt to create it if it does not;
3. add/update the generated files on `main`;
4. attempt to enable GitHub Pages from the root of `main`.

If repository creation or Pages administration is not allowed by the token, create the repository first or grant the matching permission and run Deploy again.

## Content integrity

Creatir does **not** invent playable video IDs. A catalog entry becomes playable only when a real YouTube URL/ID is supplied. A trailer, unavailable embed, age-restricted source, or one-minute preview should not masquerade as a full scheduled program. Creatir now blocks deployment when the unique verified catalog is smaller than the number of daily slots; the generated runtime also quarantines a failed embed and selects another unused title.

Media lines use this format:

```text
Program title | https://youtu.be/VIDEO_ID | runtime in minutes
```

## Shared remote

Generated sites load:

```html
<script src="https://www-infinity4.github.io/Control-Phi/control-phi.js"></script>
```

Control Phi then reads the one canonical registry:

```text
https://www-infinity4.github.io/Control-Phi/channels.json
```

That registry is the source of truth for the channel hamburger and network guide. There should not be a separately maintained channel list in each generated station.
