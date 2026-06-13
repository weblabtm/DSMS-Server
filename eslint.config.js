import js from '@eslint/js'
import globals from 'globals'
import ts from 'typescript-eslint'

export default ts.config(
  {
    ignores: ['dist', 'node_modules', 'src/generated'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-unsafe-finally': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Restrict raw database query methods to prevent tenant isolation bypass
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ignores: [
      'src/infrastructure/database/database-connection.ts',
      'tests/**/*.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='$queryRaw']",
          message: 'Do not use raw database queries ($queryRaw) as they bypass Prisma query filters and the tenant isolation extension. Use standard Prisma client model queries instead.',
        },
        {
          selector: "MemberExpression[property.name='$queryRawUnsafe']",
          message: 'Do not use raw database queries ($queryRawUnsafe) as they bypass Prisma query filters and the tenant isolation extension. Use standard Prisma client model queries instead.',
        },
        {
          selector: "MemberExpression[property.name='$executeRaw']",
          message: 'Do not use raw database queries ($executeRaw) as they bypass Prisma query filters and the tenant isolation extension. Use standard Prisma client model queries instead.',
        },
        {
          selector: "MemberExpression[property.name='$executeRawUnsafe']",
          message: 'Do not use raw database queries ($executeRawUnsafe) as they bypass Prisma query filters and the tenant isolation extension. Use standard Prisma client model queries instead.',
        },
      ],
    },
  },
)
