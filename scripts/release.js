const { spawn } = require('child_process');
const secrets = require('./secrets/env');

spawn(
  'electron-builder',
  ['build', '--config=electron-builder.config.js', '--publish=always'],
  {
    env: { ...process.env, ...secrets },
    stdio: 'inherit',
    shell: true,
  }
);
