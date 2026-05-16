import config from "@quickarte/config/eslint.config.mjs";

export default [
  ...config,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
