module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  doubleQuote: false,
  
  // Indentation
  tabWidth: 2,
  useTabs: false,
  
  // Line breaks
  printWidth: 100,
  endOfLine: 'lf',
  
  // JSX specific
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Object formatting
  bracketSpacing: true,
  objectCurlySpacing: true,
  
  // Arrow functions
  arrowParens: 'avoid',
  
  // HTML whitespace
  htmlWhitespaceSensitivity: 'css',
  
  // Embedded language formatting
  embeddedLanguageFormatting: 'auto',
  
  // Quote props
  quoteProps: 'as-needed',
  
  // Overrides for specific file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
      },
    },
    {
      files: '*.{yml,yaml}',
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: '*.py',
      options: {
        printWidth: 88,
        tabWidth: 4,
      },
    },
  ],
};