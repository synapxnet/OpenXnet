# -*- coding: utf-8 -*-
"""Small dependency-free worker used by cross-language integration tests."""

from __future__ import annotations

import argparse
import asyncio
from collections.abc import Mapping
from typing import Any

from py.workers.runtime import WorkerRuntime


def echo(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """Return a defensive copy of a test payload."""

    return {"echo": dict(payload)}


def parse_arguments() -> argparse.Namespace:
    """Parse the capability identifier used by the integration worker."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capability", default="documents")
    return parser.parse_args()


async def run() -> None:
    """Create the dependency-free runtime and serve stdio protocol requests."""

    arguments = parse_arguments()
    runtime = WorkerRuntime(arguments.capability)

    async def emit(payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Emit one event before acknowledging the test request."""

        await runtime.emit_event("demo.event", dict(payload))
        return {"emitted": True}

    runtime.register_handler("echo", echo)
    runtime.register_handler("emit", emit)
    await runtime.serve_stdio()


if __name__ == "__main__":
    asyncio.run(run())
