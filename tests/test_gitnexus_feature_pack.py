# -*- coding: utf-8 -*-
"""Tests for the activated GitNexus feature-pack runtime handoff."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from py.code_intelligence import get_gitnexus_mcp_config


class GitNexusFeaturePackConfigTests(unittest.TestCase):
    """Validate Python consumption of Desktop Core's runtime handoff."""

    def test_activated_electron_pack_is_preferred(self) -> None:
        """Use an activated pack entrypoint with Electron's Node compatibility mode."""

        with tempfile.TemporaryDirectory(prefix="openxnet-gitnexus-runtime-") as directory:
            root = Path(directory)
            entrypoint = root / "pack" / "dist" / "cli" / "index.js"
            runtime_path = root / "runtime" / "gitnexus.json"
            entrypoint.parent.mkdir(parents=True)
            runtime_path.parent.mkdir(parents=True)
            entrypoint.write_text("console.log('gitnexus')\n", encoding="utf-8")
            runtime_path.write_text(
                json.dumps(
                    {
                        "schema": "openxnet.gitnexus-runtime.v1",
                        "packVersion": "1.6.2-openxnet.1.0.2",
                        "packRoot": str(root / "pack"),
                        "entrypoint": str(entrypoint),
                        "nodeExecutable": sys.executable,
                        "nodeMode": "electron",
                    }
                ),
                encoding="utf-8",
            )

            with patch.dict(
                os.environ,
                {"OPENXNET_GITNEXUS_RUNTIME_CONFIG": str(runtime_path)},
                clear=False,
            ):
                config = get_gitnexus_mcp_config()

        self.assertEqual(config["source"], "feature_pack")
        self.assertEqual(config["args"], [str(entrypoint.resolve()), "mcp"])
        self.assertEqual(config["env"], {"ELECTRON_RUN_AS_NODE": "1"})

    def test_runtime_entrypoint_cannot_escape_pack_root(self) -> None:
        """Ignore a tampered runtime handoff whose entrypoint escapes its pack root."""

        with tempfile.TemporaryDirectory(prefix="openxnet-gitnexus-runtime-") as directory:
            root = Path(directory)
            pack_root = root / "pack"
            escaped_entrypoint = root / "outside.js"
            runtime_path = root / "gitnexus.json"
            pack_root.mkdir()
            escaped_entrypoint.write_text("console.log('outside')\n", encoding="utf-8")
            runtime_path.write_text(
                json.dumps(
                    {
                        "schema": "openxnet.gitnexus-runtime.v1",
                        "packVersion": "1.0.0",
                        "packRoot": str(pack_root),
                        "entrypoint": str(escaped_entrypoint),
                        "nodeExecutable": sys.executable,
                        "nodeMode": "node",
                    }
                ),
                encoding="utf-8",
            )

            with patch.dict(
                os.environ,
                {"OPENXNET_GITNEXUS_RUNTIME_CONFIG": str(runtime_path)},
                clear=False,
            ):
                config = get_gitnexus_mcp_config()

        self.assertNotEqual(config.get("source"), "feature_pack")


if __name__ == "__main__":
    unittest.main()
