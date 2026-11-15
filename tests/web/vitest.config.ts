import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '../../apps/web');
const require = createRequire(import.meta.url);

// Code trong apps/web import 'react', 'zustand'… từ thư mục của nó. Ép các import
// đó về node_modules của package test này để chỉ có MỘT bản React.
const own = (id: string) => ({ find: new RegExp(`^${id.replace('/', '\\/')}$`), replacement: require.resolve(id) });

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${webDir}/` },
      own('react'),
      own('react/jsx-runtime'),
      own('react/jsx-dev-runtime'),
      own('react-dom'),
      own('react-dom/client'),
      own('zustand'),
      own('zustand/vanilla'),
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
  },
});
