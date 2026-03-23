import { createServer } from "node:http";

const port = Number(process.argv[2] || "18081");

const server = createServer(async (request, response) => {
  const body = await readBody(request);

  response.statusCode = 200;
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body,
    }),
  );
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`httpbin fixture listening on http://127.0.0.1:${port}\n`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}
