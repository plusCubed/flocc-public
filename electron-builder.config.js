const { version } = require('./package.json');

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.pluscubed.flocc',
  productName: 'Flocc',
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  files: [
    'packages/**/dist/**',
    'packages/main/assets/**',
    '!node_modules/**',
    'node_modules/semver',
    'node_modules/yallist',
    'node_modules/lru-cache',
  ],
  extraMetadata: {
    version: version,
  },
  nsis: {
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
  mac: {
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'buildResources/entitlements.mac.plist',
    entitlementsInherit: 'buildResources/entitlements.mac.plist',
  },
  afterSign: 'electron-builder-notarize',
  dmg: {
    icon: false,
  },
  publish: [
    {
      provider: 's3',
      bucket: 'flocc-releases',
    },
    {
      provider: 'github',
      publishAutoUpdate: false,
    },
  ],
};

module.exports = config;
