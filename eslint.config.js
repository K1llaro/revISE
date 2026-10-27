import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Игнорируем скомпилированные и служебные папки
    ignores: [
      "dist/**",
      ".astro/**",
      "node_modules/**",
      "cdk/**",
      "scripts/**"
    ],
  },
  // Подключаем парсер и правила TypeScript для Flat Config
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Разрешаем неиспользуемые аргументы и ошибки, если они начинаются с "_"
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
    },
  }
);