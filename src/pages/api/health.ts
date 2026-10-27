import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'healthy',
      container: 'astro-blog',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
};