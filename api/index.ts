import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerApp, originalUrlFromRewrite } from '../server/vercel.js';

/**
 * Vercel serverless entry point. `vercel.json` rewrites every /api/* request
 * here; Express keeps the existing route table in server/app.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (typeof req.url === 'string') {
    req.url = originalUrlFromRewrite(req.url);
  }
  const app = await getServerApp();
  app(req, res);
}
