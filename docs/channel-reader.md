# Channel Reader Contract

The channel reader is the thin client that connects each Infinity TV channel to the shared Channel-Creatir + Cloudflare scheduler.

## Purpose

A channel repository should not independently decide its weekly lineup. It should ask the central scheduler what is airing now, then render that program at the correct elapsed point.

Current connected readers include:
- BET
- Cinemax
- HBO
- Starz
- Encore
- Showtime
- Cartoon Network
- Hermit TV
- Star Launcher

## Runtime flow

1. Channel page loads its existing local catalog/player logic.
2. `channel-reader.js` requests:
   `GET /v1/now/:channel`
3. Cloudflare returns the current scheduled program, its source, scheduled start, and playback offset.
4. The reader validates the returned YouTube source ID.
5. If the remote response is usable, the reader loads that program at the returned offset.
6. If the remote response is missing, invalid, unavailable, or unreachable, the channel keeps its existing local schedule/player as fallback.

This fallback rule is intentional. A central catalog failure must never blank an otherwise working channel.

## Reader response contract

Expected response shape:

```json
{
  "ok": true,
  "channel": "Cinemax",
  "week": "YYYY-MM-DD",
  "now": {
    "catalogId": "MOV-0008",
    "title": "Black Fox",
    "type": "movie",
    "scheduledStart": "ISO-8601 timestamp",
    "runtimeMinutes": 92,
    "sourceStartSeconds": 0,
    "source": {
      "provider": "youtube",
      "sourceId": "GI2TFFWrBlc",
      "status": "playable"
    }
  },
  "offsetSeconds": 1234
}
```

## Playback invariants

- The schedule clock is the authority.
- The reader joins the program at the correct elapsed offset.
- UI clocks must never repeatedly recreate the player.
- A source is changed only when the scheduled program changes or the source is quarantined.
- Invalid or unverified source IDs must not replace a working local program.
- Reader failures must degrade to local playback, not a blank screen.
- Schedule selection belongs to Channel-Creatir/Cloudflare, not to the channel page.

## Shared API

- `GET /v1/now/:channel` — current program + offset.
- `GET /v1/schedule/:channel?week=YYYY-MM-DD` — generated weekly schedule.
- `GET /v1/catalog/eligible` — programs currently eligible for live scheduling.
- `POST /v1/schedule/build` — explicit schedule generation/rebuild.
- `POST /v1/signals` — normalized programming-interest signals.

## Catalog relationship

Readers do not own the master catalog.

Channel-Creatir stores or references the shared growing catalog. A catalog record may be indexed before a playable source exists, but only sources with `status: "playable"` are eligible for a live schedule.

That separation lets discovery grow without allowing unverified streams to break playback.

## Petra Phi principle

Petra Phi is the planting medium for indexes.

An index should behave like healthy soil: it must accept new material, preserve useful structure, support reuse, carry context, and continue to grow instead of becoming a frozen list that goes stale.

Applied to Channel-Creatir, that means:
- metadata and source availability are separate;
- new discoveries can enter the index before they are schedulable;
- records keep reasons, tags, provenance, and relationships;
- verification can improve a record later without recreating the whole index;
- stale sources can be replaced while the catalog identity survives;
- signals can change relevance without destroying accumulated knowledge.

## Terra Phi principle

Terra Phi represents whole-system perfection: the deployment should be evaluated as a complete environment, not as isolated files that individually appear correct.

For channel readers, a Terra Phi-quality deployment means the complete path works together:

`catalog -> grader -> scheduler -> Cloudflare -> reader -> player -> fallback`

A deployment is not complete merely because code committed successfully. The finished system should preserve:
- correct source identity;
- correct schedule timing;
- correct channel fit;
- working fallback behavior;
- no destructive duplication;
- inspectable selection reasons;
- recoverability when a source fails;
- consistent behavior across connected channels.

Petra Phi keeps the knowledge medium healthy. Terra Phi keeps the whole deployed system coherent.
