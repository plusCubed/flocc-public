const { ESBuildPlugin } = require('esbuild-loader');

const rules = require('./webpack.rules');

rules.push({
  test: /\.(js|jsx)$/,
  exclude: /(node_modules|.webpack)/,
  use: {
    loader: 'esbuild-loader',
    options: {
      loader: 'jsx',
      target: 'node14',
      format: 'cjs',
    },
  },
});

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/main/main.js',
  // Put your normal webpack config below here
  module: {
    rules: rules,
  },
  plugins: [],
};
