import baseConfig from "@quickarte/config/eslint.config.mjs";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**"],
  },
];
