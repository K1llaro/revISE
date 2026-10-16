import type { APIRoute } from 'astro';
import { handler } from '../../../api/handler';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const event = {
      httpMethod: 'POST',
      headers,
      body,
    } as unknown as APIGatewayProxyEvent;

    const result = await handler(event);
    const resultHeaders = new Headers();
    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => {
        if (v !== undefined) resultHeaders.set(k, String(v));
      });
    }
    if (!resultHeaders.has('content-type')) {
      resultHeaders.set('content-type', 'application/json; charset=utf-8');
    }

    return new Response(result.body, {
      status: result.statusCode,
      headers: resultHeaders,
    });
  } catch (error) {
    console.error('API endpoint /api/data error:', error);
    return new Response(JSON.stringify({ error: 'The database API failed unexpectedly.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Authorization,Content-Type',
      'access-control-allow-methods': 'POST,OPTIONS',
    },
  });
};
