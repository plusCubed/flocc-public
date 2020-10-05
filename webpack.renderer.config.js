const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const isDevelopment = process.env.NODE_ENV !== 'production';

const rules = require('./webpack.rules');

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          plugins: [require('tailwindcss'), require('autoprefixer')],
        },
      },
    },
  ],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    isDevelopment &&
      new ReactRefreshPlugin({
        overlay: {
          sockIntegration: 'whm',
        },
      }),
  ].filter(Boolean),
};
