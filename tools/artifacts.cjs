'use strict';
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// Development output lives outside the checkout, with one directory per project.
module.exports = function artifactDirectory(root = path.resolve(__dirname, '..')) {
  const id = crypto.createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 12);
  return path.join(os.tmpdir(), 'pebble-picnic', id);
};
