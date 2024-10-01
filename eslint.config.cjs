const eslintPluginAstro = require('eslint-plugin-astro');

module.exports = [
  {
    languageOptions: {
      parserOptions: {
        parser: ["@typescript-eslint/parser", "plugin:@typescript-eslint/recommended", "eslint:recommended"],
        ecmaVersion: "latest",
        sourceType: "module",
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    rules: {},
  },
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    rules: {}
  },
  {
    ignores: [
      ".husky/*",
      ".vscode/*",
      "node_modules/*",
      "public/*",
      "dist/*",
    ],
  }
];