import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler rules that produce false positives for valid patterns:
      // - setMounted(true) in empty-dep effects is the required hydration guard
      // - setState in mount effects for initialization is intentional
      "react-hooks/set-state-in-effect": "off",
      // React Hook Form's watch() is known to be incompatible with React Compiler
      // memoization but is the correct RHF API to use
      "react-hooks/incompatible-library": "off",
      // Date.now() / new Date() in Server Components and pure helper functions is
      // intentional and stable within a single request; the purity rule produces
      // false positives here
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
