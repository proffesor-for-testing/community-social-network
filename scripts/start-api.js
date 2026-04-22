require('dotenv').config();
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

require('ts-node').register({
  project: path.join(projectRoot, 'apps/api/tsconfig.app.json'),
  transpileOnly: true,
});

require('tsconfig-paths').register({
  baseUrl: projectRoot,
  paths: require(path.join(projectRoot, 'tsconfig.base.json')).compilerOptions.paths,
});

require(path.join(projectRoot, 'apps/api/src/main.ts'));
