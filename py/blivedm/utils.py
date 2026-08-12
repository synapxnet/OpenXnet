# SPDX-FileCopyrightText: xfgryujk (blivedm)
# SPDX-FileCopyrightText: 2026 Synapxnet
# SPDX-License-Identifier: MIT
#
# 原始项目: blivedm (https://github.com/xfgryujk/blivedm)
# License: MIT
# 集成说明: 整包集成至 OpenXnet 平台，用于 B站直播弹幕接收。
# -*- coding: utf-8 -*-
USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
)


def make_constant_retry_policy(interval: float):
    def get_interval(_retry_count: int, _total_retry_count: int):
        return interval
    return get_interval


def make_linear_retry_policy(start_interval: float, interval_step: float, max_interval: float):
    def get_interval(retry_count: int, _total_retry_count: int):
        return min(
            start_interval + (retry_count - 1) * interval_step,
            max_interval
        )
    return get_interval
