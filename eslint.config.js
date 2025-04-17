import globals from "globals";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: ["@typescript-eslint/parser", "plugin:@typescript-eslint/recommended", "eslint:recommended"],
        ecmaVersion: "latest",
        sourceType: "module",
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
  },
  {
    rules: {}
  },
  {
    ignores: [
      ".husky/**",
      ".vscode/**",
      "node_modules/**",
      "public/**",
      "dist/**",
      ".astro",
      "public/pagefind/**"
    ],
  }
];