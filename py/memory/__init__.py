#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.

"""
记忆子系统包初始化。

提供三路记忆联邦（mem0 + NeuroSymbol + Hindsight）的统一入口，
包括 Hindsight 外部桥接和跨源去重融合中枢。

Author: maoyo
Department: 研发部
Date: 2026-04-13
Version: 1.0.0
Security Level: INTERNAL
"""

__version__ = "1.0.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

# Modification History:
# 2026-04-13, v1.0.0, maoyo: Initial creation.
# 2026-04-19, v1.1.0, Claude Code: Add ObservationStore and migration exports.

from py.memory.observation_store import (  # noqa: F401
    ObservationStore,
    get_observation_store,
    close_all_stores,
)
from py.memory.migration import migrate_json_to_sqlite  # noqa: F401
