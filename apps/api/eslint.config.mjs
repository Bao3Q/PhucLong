// ESLint cho backend NestJS (flat config, ESLint 9 + typescript-eslint 8).
// Chạy: npm --prefix apps/api run lint  (CI: job "Backend CI").
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "src/generated/**", "coverage/**", "node_modules/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // NestJS dùng nhiều decorator/DI và test mock: cho phép any nhưng cảnh báo.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Một số test dùng require() để nạp module CommonJS.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
