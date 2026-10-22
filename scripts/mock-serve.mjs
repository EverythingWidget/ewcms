/**
 * The mock sandbox's own dev server (sandbox/README.md): npm run mock:serve
 * `ewcms dev` (HMR; a new sandbox/mocks/*.svelte shows up by itself) for a site: MOCK_SITE, else
 * the working folder when it is a site, else the test fixture. On MOCK_PORT (default 5199, away
 * from the ports `ewcms dev` picks: 5173, 5174, …); prints the viewer's URL.
 * Plain Node, no shell: the same on Windows, macOS and Linux.
 */
import { dev } from './cli.mjs';
import { mockSite } from './engine.mjs';

const port = Number(process.env.MOCK_PORT || 5199);
const server = await dev(mockSite(), { port, images: false });
const local = server.resolvedUrls?.local?.[0] || `http://localhost:${port}/`;
console.log(`\n  Mock sandbox: ${new URL('sandbox/', local)}\n`);
