import { createServer } from 'node:http';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handler.ts';

const port = Number(process.env.LOCAL_API_PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('LOCAL_API_PORT must be a valid TCP port.');
}

const server = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'Authorization,Content-Type');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('vary', 'Origin');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const path = url.pathname;

  const isDataPost = request.method === 'POST' && path === '/api/data';
  const isHealthGet = request.method === 'GET' && path === '/api/health';

  if (!isDataPost && !isHealthGet) {
    response.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Not found.' }));
    return;
  }

  const chunks: Buffer[] = [];
  let bodyLength = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bodyLength += buffer.length;
    if (bodyLength > 1_000_000) {
      response.writeHead(413, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: 'Request body is too large.' }));
      return;
    }
    chunks.push(buffer);
  }

  const headers = Object.fromEntries(
    Object.entries(request.headers)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );

  const event = {
    httpMethod: request.method,
    path,
    headers,
    body: Buffer.concat(chunks).toString('utf8'),
  } as unknown as APIGatewayProxyEvent;

  try {
    const result = await handler(event);
    const resultHeaders = Object.fromEntries(
      Object.entries(result.headers || {})
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([name, value]) => [name, String(value)]),
    );
    response.writeHead(result.statusCode, resultHeaders).end(result.body);
  } catch (error) {
    console.error('Local Turso API request failed.', error);
    response.writeHead(500, { 'content-type': 'application/json' })
      .end(JSON.stringify({ error: 'The local database API failed unexpectedly.' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local Turso API listening at http://127.0.0.1:${port}/api/data and http://127.0.0.1:${port}/api/health`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}