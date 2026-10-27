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
      // Отключаем ложные конфликты стандартного JS с TypeScript
      "no-undef": "off",
      "no-unused-vars": "off",
      // Мягкие предупреждения вместо падений билда
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  }
);