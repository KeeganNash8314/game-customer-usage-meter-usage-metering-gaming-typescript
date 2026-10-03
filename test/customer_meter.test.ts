import assert from "node:assert/strict";
import test from "node:test";
import { CustomerMeter } from "../src/customer_meter.js";

test("weights game activity and ignores a repeated event id", () => {
  const meter = new CustomerMeter();

  meter.record({ eventId: "evt-asset", customerId: "studio-42", kind: "player_asset_generated", quantity: 1 });
  meter.record({ eventId: "evt-live", customerId: "studio-42", kind: "live_event", quantity: 3 });
  meter.record({ eventId: "evt-review", customerId: "studio-42", kind: "moderation_queued", quantity: 2 });
  const duplicate = meter.record({
    eventId: "evt-review",
    customerId: "studio-42",
    kind: "moderation_queued",
    quantity: 2,
  });

  assert.equal(duplicate.accepted, false);
  assert.deepEqual(meter.snapshot("studio-42"), {
    customerId: "studio-42",
    billableUnits: 12,
    acceptedEvents: 3,
    byKind: {
      player_asset_generated: { quantity: 1, billableUnits: 5 },
      live_event: { quantity: 3, billableUnits: 3 },
      moderation_queued: { quantity: 2, billableUnits: 4 },
    },
  });
});
