const { IgnorePlugin } = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const isDevelopment = process.env.NODE_ENV !== 'production';

const rules = require('./webpack.rules');

rules.push(
  {
    test: /\.(js|jsx)$/,
    exclude: /(node_modules|.webpack)/,
    use: {
      loader: 'esbuild-loader',
      options: {
        loader: 'jsx',
        target: 'es2020',
      },
    },
  },
  {
    test: /\.css$/,
    use: [
      isDevelopment && { loader: 'style-loader' },
      !isDevelopment && { loader: MiniCssExtractPlugin.loader },
      { loader: 'css-loader' },
      {
        loader: 'postcss-loader',
        options: {
          postcssOptions: {
            plugins: [require('tailwindcss'), require('autoprefixer')],
          },
        },
      },
    ].filter(Boolean),
  }
);

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    /*isDevelopment &&
      new ReactRefreshPlugin({
        overlay: {
          sockIntegration: 'whm',
        },
      }),*/
    !isDevelopment &&
      new MiniCssExtractPlugin({
        filename: 'main_window/[name].[contenthash:8].css',
        chunkFilename: 'main_window/[name].[contenthash:8].chunk.css',
      }),
    new IgnorePlugin({
      resourceRegExp: /^firebase\/(analytics|firestore|functions|messaging|performance|remote-config|storage)$/,
    }),
  ].filter(Boolean),
  output: { chunkFilename: 'main_window/[name].chunk.js', publicPath: '../' },
};
