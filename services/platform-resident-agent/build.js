#!/usr/bin/env node
// -*- coding: utf-8 -*-
// Copyright (C) 2026 Synapxnet. All rights reserved.
// This file is Synapxnet Proprietary and Confidential. It is strictly
// forbidden to copy, distribute, or use without explicit authorization.
// 驻场服务契约构建 / Resident service contract build
// Author: maoyo
// Department: 研发部
// Date: 2026-09-16
// Version: 1.3.0
// Security Level: INTERNAL
// __version__ = "1.3.0"; __author__ = "maoyo"; __copyright__ = "Copyright 2026 Synapxnet"
// __maintainer__ = "maoyo"; __email__ = "synapxnet@gmail.com"
"use strict";
const fs = require("node:fs");
const path = require("node:path");

/** 从当前核心构建导出共享契约。 / Export shared contracts from the current core build. */
function build() {
  const source = path.resolve(__dirname, "../../build-ts/desktop/competition");
  const destination = path.join(__dirname, "vendor");
  fs.mkdirSync(destination, { recursive: true });
  const header = fs.readFileSync(__filename, "utf8").split('"use strict";')[0].replace("#!/usr/bin/env node\n", "");
  for (const filename of ["competition-tool-registry.js", "competition-tool-adapter.js", "competition-resource-versions.js"]) {
    fs.writeFileSync(path.join(destination, filename), header + fs.readFileSync(path.join(source, filename), "utf8"));
  }
}
build();
