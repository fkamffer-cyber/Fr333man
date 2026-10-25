import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.site-publish/**',
    '.vinext/**',
    '.wrangler/**',
    'dist/**',
    'out/**',
    'build/**',
    'outputs/**',
    'tmp/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
