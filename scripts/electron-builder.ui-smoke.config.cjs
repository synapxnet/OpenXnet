"use strict";

const packageJson = require("../package.json");

module.exports = {
  ...packageJson.build,
  directories: {
    ...packageJson.build.directories,
    output: "release-ui-smoke",
  },
  extraResources: [
    {
      from: "static/",
      to: "ui",
      filter: ["**/*"],
    },
  ],
  publish: null,
};
