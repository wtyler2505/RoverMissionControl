// Jest watch mode configuration
module.exports = {
  watchPlugins: [
    // Built-in watch plugins
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
    
    // Custom watch plugin for selecting tests by component
    {
      path: require.resolve('./jest-watch-component-plugin.js'),
      config: {
        key: 'c',
        prompt: 'filter by component name',
      },
    },
    
    // Custom watch plugin for running tests by folder
    {
      path: require.resolve('./jest-watch-folder-plugin.js'),
      config: {
        key: 'f',
        prompt: 'filter by folder',
      },
    },
  ],
};