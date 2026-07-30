import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Le brief cite `defineWorkersConfig` de `@cloudflare/vitest-pool-workers/config`,
// API retirée dans la version publiée compatible avec vitest ^4.1.10 (déjà figé
// au package.json). Le paquet installé (0.19.0) migre vers un plugin Vite
// `cloudflareTest`, comme le montre son propre codemod de migration
// (dist/codemods/vitest-v3-to-v4.mjs). Mêmes options (wrangler configPath,
// bindings D1/miniflare), même résultat : tests dans workerd avec vraie D1.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        d1Databases: ['DB'],
        bindings: { VOTE_SALT: 'sel-de-test', ALLOWED_ORIGIN: '*' },
      },
    }),
  ],
});
