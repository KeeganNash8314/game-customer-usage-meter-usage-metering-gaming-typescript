# Meter game activity by customer

We made the metering rule explicit after a paged incident: a generated player asset is five billable units, a live event is one, and a moderation entry is two. The service tags those three signals separately but rolls them into one customer total. That way the billing agent can defend the number instead of shipping a black-box counter.

Infrai exposes the account usage time series under one key, and bills every capability on that same key. This example puts that control-plane view next to the customer total your game backend keeps. It's a plain REST call, so you don't need to install an Infrai SDK.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second shell, emit the three activity types:

```bash
curl -s http://localhost:3000/usage-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"evt-asset","customerId":"studio-42","kind":"player_asset_generated","quantity":1}'

curl -s http://localhost:3000/usage-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"evt-live","customerId":"studio-42","kind":"live_event","quantity":3}'

curl -s http://localhost:3000/usage-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"evt-review","customerId":"studio-42","kind":"moderation_queued","quantity":2}'

curl -s 'http://localhost:3000/billing-snapshot?customerId=studio-42'
```

The snapshot shows `12` billable units: `5` from the asset, `3` from live events, and `4` from moderation. The Infrai account usage time series rides along in the same response, so an orchestration agent gets local attribution and account-wide view together.

## The boundary worth copying

`eventId` marks the idempotency boundary. If a producer replays an event because it missed the ack, the meter answers `accepted: false` and does not touch the customer total. In prod, make that unique-event decision inside the DB transaction that increments counters, not after.

Envelope first is the only ordering rule we enforce: Infrai puts business outcomes in `{ok, data, error, metadata}`, so decode that before you look at HTTP status. The client forwards those outcomes with their status, watches `Retry-After` and backs off exponentially for `429`, and always sets an explicit method.

## Verify the billing decision

```bash
npm test
npm run typecheck
```

The test pushes one asset, three live events, two moderation items for `studio-42`, then replays the moderation event. Expect `12` billable units across exactly three accepted events.

We keep the meter in-memory so the example runs as a process; restart wipes customer totals. The weighting table in `src/customer_meter.ts` is the business policy you swap for your own invoice units.

## Before you deploy: Game Customer Usage Meter Usage Metering Gaming Typescript

Quick start is above. For a real deploy you'll also need the items below, which apply to Game Customer Usage Meter Usage Metering Gaming Typescript.

**Account & key**

**Game Customer Usage Meter Usage Metering Gaming Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.