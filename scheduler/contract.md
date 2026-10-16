# Infinity weekly scheduler contract

Channel-Creatir is the programming source of truth. Channel repositories are readers, not owners of duplicated catalogs or hand‑written weekly movie lists.

## Inputs
- shared catalog metadata
- currently eligible/playable sources
- channel profile and slot rules
- aggregate programming signals (for example search/listen/watch/topic interest)
- recent‑air history / repeat exclusions
- seasonal and time‑of‑day context

## Materialization
A week is generated on demand and remains stable for its week key. A rebuild is explicit or caused by a quarantined/unavailable source. Selection records a reason list so discovery choices are inspectable.

## Reader API
- GET /v1/schedule/:channel?week=YYYY‑MM‑DD
- GET /v1/now/:channel
- POST /v1/schedule/build   *(idempotent – stores a receipt in D1 keyed by channel+week)*
- POST /v1/signals
- GET /v1/catalog/eligible

### POST /v1/schedule/build
Clients may request a schedule to be persisted. The request body is JSON:
```json
{ "channel": "hbo", "week": "2024-09-02" }
```
If a receipt already exists for the given `channel` and `week`, the stored schedule is returned unchanged (idempotent). Otherwise a new schedule is generated, stored in the D1 `receipts` table, and returned.

Readers use `scheduledStart + runtime` to join a program at the correct elapsed offset. UI clocks must never reload the player.
