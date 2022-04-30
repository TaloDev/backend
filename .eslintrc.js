// eslint-disable-next-line no-undef
module.exports = {
  env: {
    es2021: true
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    'indent': ['error', 2, { 'SwitchCase': 1, 'ignoredNodes': ['PropertyDefinition'] }],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': ['warn'],
    'object-curly-spacing': [2, 'always'],
    'arrow-parens': ['error', 'always'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'eol-last': ['warn', 'always']
  }
}
