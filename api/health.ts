export const config = { runtime: 'edge' };

export default async function handler() {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'
  }), { headers: { 'Content-Type': 'application/json' } });
}
