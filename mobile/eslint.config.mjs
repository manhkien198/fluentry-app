export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "**/dist/**",
      "**/build/**",
      "**/.expo/**",
      "**/backend/**",
      "**/docs/**",
      "**/infra/**",
      "**/mobile/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: (await import("@typescript-eslint/parser")).default,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": (await import("@typescript-eslint/eslint-plugin"))
        .default,
      react: (await import("eslint-plugin-react")).default,
      "react-hooks": (await import("eslint-plugin-react-hooks")).default,
      "react-native": (await import("eslint-plugin-react-native")).default,
      jest: (await import("eslint-plugin-jest")).default,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...((await import("eslint-plugin-react-hooks")).default.configs
        ?.recommended?.rules ?? {}),
      "react/react-in-jsx-scope": "off",
      "react-native/no-inline-styles": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
