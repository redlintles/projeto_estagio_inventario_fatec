import http from "node:http";
const unit = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "F1",
  name: "Fatec de teste",
  active: true,
};
const location = {
  id: "33333333-3333-4333-8333-333333333333",
  code: "LAB",
  description: "Laboratório de coleta",
  active: true,
};
const inventory = {
  id: "44444444-4444-4444-8444-444444444444",
  locationId: location.id,
  userId: "test-owner",
  expectedIds: [
    "11111111-1111-4111-8111-111111111110",
    "11111111-1111-4111-8111-111111111111",
  ],
  items: [],
  status: "OPEN",
  startedAt: "2026-10-15T12:30:00Z",
};
const assets = ["I", "A", "X"].map((status, i) => ({
  id: `11111111-1111-4111-8111-11111111111${i}`,
  patrimony: `00010${i + 1}`,
  description: ["Mesa de coleta", "Cadeira de coleta", "Bem baixado"][i],
  group: "Mobiliário",
  uniqueCode: i < 2 ? "COMPARTILHADO" : "BAIXADO",
  originUnit: "270",
  unitId: i === 0 ? null : unit.id,
  locationId: location.id,
  status,
  version: 1,
  value: "125.50",
  incorporationDate: "2026-09-01",
  condition: null,
}));
const user = {
  id: "test-owner",
  name: "Coletor de teste",
  email: "coletor@example.org",
  role: "CONSULTA",
  permissions: [
    "assets.view",
    "units.view",
    "locations.view",
    "inventories.view",
    "inventories.manage",
    "photos.upload",
  ],
  primaryAdmin: false,
};
let config = { photoStatus: 200, syncStatus: 200 },
  stats,
  receipts;
function reset() {
  stats = {
    actions: [],
    syncRequests: 0,
    photoRequests: 0,
    uploadIds: [],
    eventIds: [],
    bytes: [],
  };
  receipts = new Map();
}
reset();
const server = http.createServer(async (req, res) => {
  let chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks),
    url = new URL(req.url, "http://fixture"),
    path = url.pathname.replace("/api/", "");
  res.setHeader("Content-Type", "application/json");
  const send = (value, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  let data = {};
  try {
    data = JSON.parse(body.toString());
  } catch {}
  if (path === "test/reset") {
    reset();
    config = { photoStatus: 200, syncStatus: 200, ...data };
    return send({ ok: true });
  }
  if (path === "test/config") {
    Object.assign(config, data);
    return send({ ok: true });
  }
  if (path === "test/status") return send(stats);
  if (path === "auth/login") return send({ token: "test-token", user });
  if (path === "auth/me") return send(user);
  if (path === "auth/logout") return send({ ok: true });
  if (path === "assets") {
    const offset = Number(url.searchParams.get("offset") || 0);
    return send(
      assets.slice(
        offset,
        offset + Number(url.searchParams.get("limit") || 1000),
      ),
    );
  }
  if (path === "units") return send([unit]);
  if (path === "locations") return send([location]);
  if (path === "inventories")
    return send(req.method === "POST" ? inventory : [inventory]);
  if (/^inventories\/[^/]+\/(cancel|complete)$/.test(path)) {
    const action = path.endsWith("cancel") ? "CANCELLED" : "CLOSED";
    stats.actions.push(action);
    return send({
      ...inventory,
      status: action,
      finishedAt: new Date().toISOString(),
    });
  }
  if (/^inventories\/[^/]+$/.test(path)) return send(inventory);
  if (path === "sync") {
    stats.syncRequests++;
    if (config.syncStatus !== 200)
      return send({ message: "Falha de teste na leitura" }, config.syncStatus);
    if (!receipts.has(data.operationId))
      receipts.set(data.operationId, {
        asset: {
          ...(assets.find((a) => a.id === data.input.assetId) ?? assets[0]),
          id: data.input.assetId,
          version: 2,
        },
        divergenceId: data.input.divergence ? "test-event" : null,
        item: { id: "test-item" },
      });
    return send(receipts.get(data.operationId));
  }
  if (/^assets\/[^/]+\/photos$/.test(path)) {
    stats.photoRequests++;
    const upload = url.searchParams.get("uploadId"),
      event = url.searchParams.get("eventId");
    if (!stats.uploadIds.includes(upload)) stats.uploadIds.push(upload);
    if (event && !stats.eventIds.includes(event)) stats.eventIds.push(event);
    stats.bytes.push(body.length);
    return send(
      config.photoStatus === 200
        ? { id: upload }
        : { message: "Sem permissão de foto (teste)" },
      config.photoStatus,
    );
  }
  return send({ message: "Rota inexistente: " + path }, 404);
});
server.listen(3101, "127.0.0.1", () =>
  console.log(
    "API de teste Android em 127.0.0.1:3101; dados exclusivamente fictícios.",
  ),
);
