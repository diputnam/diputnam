import { createClient } from '@sanity/client';

// Build-time content client. `useCdn: false` reads the live API instead of Sanity's CDN:
// the site rebuilds once per publish (via the Sanity webhook), right after the content
// changes, and the CDN edge that serves the build's region can still be stale at that
// exact moment — a build has none of the request-volume the CDN exists to absorb, so
// there is nothing to trade that consistency for. SANITY_LOCAL_DATASET (a JSON array of
// documents, see studio/scripts/seed-local.ts) evaluates the same GROQ locally with
// groq-js so the site can be built and tested without a project. Neither set → fail loudly.
const env = (name: string) => ((import.meta as { env?: Record<string, string> }).env?.[name]) ?? process.env[name];

type Fetch = <T>(query: string, params?: Record<string, unknown>) => Promise<T>;

const localFetch = async (file: string): Promise<Fetch> => {
  const { readFile } = await import('node:fs/promises');
  const { evaluate, parse } = await import('groq-js');
  const dataset = JSON.parse(await readFile(file, 'utf8')) as unknown[];
  return async <T>(query: string, params: Record<string, unknown> = {}) => (await evaluate(parse(query), { dataset, params })).get() as Promise<T>;
};

const remoteFetch = (): Fetch => {
  // Vercel's Sanity integration injects NEXT_PUBLIC_SANITY_* / SANITY_STUDIO_* instead.
  const projectId = env('SANITY_PROJECT_ID') || env('NEXT_PUBLIC_SANITY_PROJECT_ID') || env('SANITY_STUDIO_PROJECT_ID');
  const dataset = env('SANITY_DATASET') || env('NEXT_PUBLIC_SANITY_DATASET') || env('SANITY_STUDIO_DATASET');
  const missing = [!projectId && 'SANITY_PROJECT_ID', !dataset && 'SANITY_DATASET'].filter(Boolean);
  if (missing.length) throw new Error(`Sanity: missing ${missing.join(' and ')} (copy .env.example to .env or set SANITY_LOCAL_DATASET for an offline build)`);
  const client = createClient({ projectId, dataset, apiVersion: '2026-09-01', useCdn: false, perspective: 'published' });
  return <T>(query: string, params: Record<string, unknown> = {}) => client.fetch<T>(query, params);
};

const localFile = env('SANITY_LOCAL_DATASET');
export const sanityFetch: Fetch = localFile ? await localFetch(localFile) : remoteFetch();
