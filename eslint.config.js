export default [
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "cdk/**"]
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        URL: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
