import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import hooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.vite/**', 'out/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }, globals: { document: 'readonly', window: 'readonly', HTMLElement: 'readonly', HTMLDivElement: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', localStorage: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', process: 'readonly', __dirname: 'readonly', console: 'readonly', Buffer: 'readonly', NodeJS: 'readonly' } },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': hooks },
    rules: { ...tsPlugin.configs.recommended.rules, ...hooks.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'off' }
  }
];
