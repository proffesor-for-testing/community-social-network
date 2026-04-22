module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    complexity: ['warn', { max: 1 }],
    'max-depth': ['warn', { max: 1 }],
    'max-lines-per-function': ['warn', { max: 1, skipBlankLines: true, skipComments: true, IIFEs: true }],
    'max-lines': ['warn', { max: 1, skipBlankLines: true, skipComments: true }],
    'max-nested-callbacks': ['warn', 1],
    'max-params': ['warn', 1],
  },
};
