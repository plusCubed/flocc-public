const path = require('path');
const githubAuthToken = require('./githubAuthToken.js');

module.exports = {
  packagerConfig: {
    name: 'Flocc',
    executableName: 'Flocc',
    /*asar: true,*/
    icon: path.resolve(__dirname, 'assets', 'icon'),
    appBundleId: 'com.pluscubed.flocc',
    usageDescription: {
      Microphone: 'Allow microphone access to talk with friends',
    },
    osxSign: {
      identity: 'Apple Development',
      hardenedRuntime: true,
      'gatekeeper-assess': false,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      type: 'development',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Flocc',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'pluscubed',
          name: 'flocc',
        },
        draft: true,
        prerelease: false,
        authToken: githubAuthToken,
      },
    },
  ],
  plugins: [
    [
      '@electron-forge/plugin-webpack',
      {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/renderer/index.html',
              js: './src/renderer/index.js',
              name: 'main_window',
            },
          ],
        },
      },
    ],
  ],
};
