// Flat config for ESLint v9. Keeps lint working without the removed --ext flag.
// TypeScript files under src and tests are linted with the TS parser (no
// rules enforced yet); build output, deps, examples bundles and the future
// webdocs app are ignored.
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "examples/**/node_modules/**",
      "examples/**/dist/**",
      "webdocs/**",
    ],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {},
  },
];
