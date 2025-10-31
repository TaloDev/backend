import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import stylistic from '@stylistic/eslint-plugin'
import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.js',
      '*.mjs'
    ]
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: true,
        ecmaVersion: 2024,
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
        'clay': 'readonly',
        NodeJS: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoredNodes: ['PropertyDefinition'] }],
      '@stylistic/no-trailing-spaces': ['warn'],
      '@stylistic/object-curly-spacing': [2, 'always'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/eol-last': ['warn', 'always'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none',
          requireLast: false
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            '@mikro-orm/core'
          ]
        }
      ],
    }
  },
  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        // vitest
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // test-specific
        app: 'readonly',
        ctx: 'readonly',
        em: 'readonly',
        clickhouse: 'readonly',
        redis: 'readonly'
      }
    }
  },
  // restricted for src files
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'app',
        'ctx',
        'em',
        'clickhouse',
        'redis'
      ]
    }
  }
]
