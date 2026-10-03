import { createServer, type ServerResponse } from "node:http";
import { CustomerMeter, InfraiError, readAccountUsageTimeseries, usageEventSchema } from "./customer_meter.js";

const meter = new CustomerMeter();
const port = Number(process.env.PORT ?? 3000);

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    if (request.method === "POST" && url.pathname === "/usage-events") {
      const parsed = usageEventSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        send(response, 400, { error: "Invalid usage event", issues: parsed.error.issues });
        return;
      }
      const result = meter.record(parsed.data);
      send(response, result.accepted ? 202 : 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/billing-snapshot") {
      const customerId = url.searchParams.get("customerId");
      if (!customerId) {
        send(response, 400, { error: "customerId is required" });
        return;
      }
      const apiKey = process.env.INFRAI_API_KEY;
      if (!apiKey) {
        send(response, 503, { error: "INFRAI_API_KEY is required" });
        return;
      }
      const accountUsageTimeseries = await readAccountUsageTimeseries(apiKey);
      send(response, 200, {
        customer: meter.snapshot(customerId),
        accountUsageTimeseries,
      });
      return;
    }

    send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, detail: error.detail });
      return;
    }
    send(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
}).listen(port, () => {
  console.log(`Game usage meter listening on http://localhost:${port}`);
});
