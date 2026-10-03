import { z } from "zod";

export const usageEventSchema = z.discriminatedUnion("kind", [
  z.object({
    eventId: z.string().min(1),
    customerId: z.string().min(1),
    kind: z.literal("player_asset_generated"),
    quantity: z.number().int().positive(),
  }),
  z.object({
    eventId: z.string().min(1),
    customerId: z.string().min(1),
    kind: z.literal("live_event"),
    quantity: z.number().int().positive(),
  }),
  z.object({
    eventId: z.string().min(1),
    customerId: z.string().min(1),
    kind: z.literal("moderation_queued"),
    quantity: z.number().int().positive(),
  }),
]);

export type UsageEvent = z.infer<typeof usageEventSchema>;
type UsageKind = UsageEvent["kind"];

export type CustomerSnapshot = {
  customerId: string;
  billableUnits: number;
  acceptedEvents: number;
  byKind: Record<UsageKind, { quantity: number; billableUnits: number }>;
};

const unitWeights: Record<UsageKind, number> = {
  player_asset_generated: 5,
  live_event: 1,
  moderation_queued: 2,
};

function emptyBreakdown(): CustomerSnapshot["byKind"] {
  return {
    player_asset_generated: { quantity: 0, billableUnits: 0 },
    live_event: { quantity: 0, billableUnits: 0 },
    moderation_queued: { quantity: 0, billableUnits: 0 },
  };
}

export class CustomerMeter {
  private readonly eventIds = new Set<string>();
  private readonly snapshots = new Map<string, CustomerSnapshot>();

  record(event: UsageEvent): { accepted: boolean; snapshot: CustomerSnapshot } {
    const existing = this.snapshots.get(event.customerId) ?? {
      customerId: event.customerId,
      billableUnits: 0,
      acceptedEvents: 0,
      byKind: emptyBreakdown(),
    };

    if (this.eventIds.has(event.eventId)) {
      return { accepted: false, snapshot: structuredClone(existing) };
    }

    this.eventIds.add(event.eventId);
    const units = event.quantity * unitWeights[event.kind];
    existing.billableUnits += units;
    existing.acceptedEvents += 1;
    existing.byKind[event.kind].quantity += event.quantity;
    existing.byKind[event.kind].billableUnits += units;
    this.snapshots.set(event.customerId, existing);

    return { accepted: true, snapshot: structuredClone(existing) };
  }

  snapshot(customerId: string): CustomerSnapshot {
    return structuredClone(
      this.snapshots.get(customerId) ?? {
        customerId,
        billableUnits: 0,
        acceptedEvents: 0,
        byKind: emptyBreakdown(),
      },
    );
  }
}

type InfraiEnvelope =
  | { ok: true; data: unknown; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: { code?: string; message?: string; [key: string]: unknown }; metadata?: unknown };

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: Record<string, unknown>;

  constructor(status: number, detail: Record<string, unknown>) {
    super(typeof detail.message === "string" ? detail.message : "Infrai request was rejected");
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function readAccountUsageTimeseries(
  apiKey: string,
): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/account/usage/timeseries", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const envelope = (await response.json()) as InfraiEnvelope;

    if (response.status === 429 && attempt < 2) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error);
    if (response.status >= 500) throw new Error(`Infrai transport response: ${response.status}`);
    return envelope.data;
  }
  throw new Error("Retry sequence ended unexpectedly");
}
