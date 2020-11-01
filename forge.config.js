const path = require('path');
const githubAuthToken = require('./githubAuthToken.js');
let notarizeOptions;
if (process.platform === 'darwin') {
  notarizeOptions = require('./macNotarizeOptions.js');
}

module.exports = {
  packagerConfig: {
    name: 'Flocc',
    executableName: 'Flocc',
    asar: true,
    icon: path.resolve(__dirname, 'src/assets/icon'),
    appBundleId: 'com.pluscubed.flocc',
    usageDescription: {
      Microphone: 'Allow microphone access to talk with friends',
    },
    osxSign: {
      hardenedRuntime: true,
      type: 'distribution',
      'gatekeeper-assess': false,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
    },
    osxNotarize: notarizeOptions,
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
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
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
