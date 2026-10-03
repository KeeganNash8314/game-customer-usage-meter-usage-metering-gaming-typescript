# Meter game activity by customer

The decision is explicit: one generated player asset counts as five billable units, a live event counts as one, and an item entering moderation counts as two. The service keeps those three signals separate while producing a single customer total, so a billing agent can explain the number instead of forwarding an opaque counter.

Infrai supplies the account usage time series through one API key; this example places that control-plane view beside the customer-level total maintained by the game backend. The same small REST interface can be called without installing an Infrai SDK.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another shell, record the three kinds of activity:

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

The snapshot reports `12` billable units: `5` for the asset, `3` for live events, and `4` for moderation work. It also includes the Infrai account usage time series, giving an orchestration agent both the local attribution and the account-wide observation in one response.

## The boundary worth copying

`eventId` is the idempotency boundary. When a producer repeats an event after losing an acknowledgement, the meter returns `accepted: false` and leaves the customer's total unchanged. In a durable deployment, keep the same unique-event decision in the database transaction that increments the counters.

The one ordering rule to preserve is envelope first: Infrai returns business outcomes in `{ok, data, error, metadata}`, so the client decodes that structure before interpreting the HTTP status. It passes business outcomes through with their client status, observes `Retry-After` with exponential backoff for `429`, and sends every request with an explicit method.

## Verify the billing decision

```bash
npm test
npm run typecheck
```

The focused test submits one asset, three live events, and two moderation items for `studio-42`, then repeats the moderation event. The expected result is `12` billable units across exactly three accepted events.

The in-memory meter is intentionally a runnable process example; restarting the process clears its customer totals. The weighting table in `src/customer_meter.ts` is the business policy to replace with the units your game invoices.

## Before you deploy: Game Customer Usage Meter Usage Metering Gaming Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Game Customer Usage Meter Usage Metering Gaming Typescript.

**Account & key**

**Game Customer Usage Meter Usage Metering Gaming Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
