const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: '@marshallofsound/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.(js|jsx)$/,
    exclude: /(node_modules|.webpack)/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [['@babel/preset-env'], ['@babel/preset-react']],
        plugins: [
          isDevelopment && require.resolve('react-refresh/babel'),
        ].filter(Boolean),
      },
    },
  },
  // Put your webpack loader rules in this array.  This is where you would put
  // your ts-loader configuration for instance:
  /**
   * Typescript Example:
   *
   * {
   *   test: /\.tsx?$/,
   *   exclude: /(node_modules|.webpack)/,
   *   loaders: [{
   *     loader: 'ts-loader',
   *     options: {
   *       transpileOnly: true
   *     }
   *   }]
   * }
   */
];
