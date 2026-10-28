import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handler.ts';

const port = Number(process.env.PORT || 4321);
const distDir = join(process.cwd(), 'dist');

const MIMES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'Authorization,Content-Type');
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  response.setHeader('vary', 'Origin');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Динамические API маршруты (/api/health, /api/data)
  if (pathname.startsWith('/api/')) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const headers = Object.fromEntries(
      Object.entries(request.headers)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );

    const event = {
      httpMethod: request.method,
      path: pathname,
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
      console.error('API request failed:', error);
      response.writeHead(500, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: 'Internal API error' }));
    }
    return;
  }

  // 2. Раздача статики Astro из dist/
  let filePath = join(distDir, pathname);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!existsSync(filePath)) {
    filePath = join(distDir, 'index.html'); // SPA fallback
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    response.writeHead(200, { 'content-type': MIMES[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } else {
    response.writeHead(404).end('Not found');
  }
});

// Слушаем на 0.0.0.0, чтобы балансировщик ALB мог достучаться до контейнера
server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}