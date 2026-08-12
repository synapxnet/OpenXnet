const path = require('path');

const pkg = require('../package.json');

const build = JSON.parse(JSON.stringify(pkg.build || {}));
build.directories = build.directories || {};
build.win = build.win || {};

// Official Windows releases must verify update signatures. Keep this in the
// signing-only config so local unsigned builds can still be produced normally.
build.win.verifyUpdateCodeSignature = true;

if (process.env.WIN_CSC_SHA1) {
  build.win.certificateSha1 = process.env.WIN_CSC_SHA1.trim();
}

if (process.env.WIN_CSC_SUBJECT_NAME) {
  build.win.certificateSubjectName = process.env.WIN_CSC_SUBJECT_NAME.trim();
}

if (process.env.WIN_SIGN_PUBLISHER_NAME) {
  build.win.publisherName = process.env.WIN_SIGN_PUBLISHER_NAME.trim();
}

if (process.env.WIN_SIGN_OUTPUT_DIR) {
  build.directories.output = path.resolve(process.env.WIN_SIGN_OUTPUT_DIR);
}

module.exports = build;
