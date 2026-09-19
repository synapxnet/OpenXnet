#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""真实执行链回归测试 / Regression tests of the actual execution chain.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
"""

import json
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from runtime import FeatureDriftRuntime, RuntimeErrorResponse, TOOLS, create_server, digest, file_digest

__version__ = "1.3.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"


class RealRuntimeTest(unittest.TestCase):
    """检查真实执行与审批边界 / Check real execution and approval boundaries."""

    def setUp(self):
        """为每个用例创建独立存储 / Create independent storage for every test."""
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.runtime = FeatureDriftRuntime(self.root)
        self.counter = 0

    def tearDown(self):
        """关闭测试存储 / Close test storage."""
        self.runtime.close()
        self.temp.cleanup()

    def initialize(self, incident="inc_success", failure="none"):
        """通过显式动作创建演练 / Create a rehearsal using the explicit action."""
        return self.runtime.action("initialize", {"workspaceId": "workspace_test", "incidentId": incident, "traceId": "trace_" + incident, "requestId": "init_" + incident, "idempotencyKey": "init_" + incident, "arguments": {"failureMode": failure, "rollbackRevision": 17}})

    def request(self, action, args, incident="inc_success", compensation=False):
        """构造与真实审批字段一致的请求 / Build a request matching real approval fields."""
        self.counter += 1
        resource = self.runtime.resource_for(action)
        return {"workspaceId": "workspace_test", "incidentId": incident, "traceId": "trace_" + incident, "requestId": "request_" + str(self.counter), "idempotencyKey": "idem_" + str(self.counter), "approvalId": "approval_test", "approverId": "human_test", "actorId": "executor_test", "planId": "feature-drift-full-recovery-v2", "planDigest": "a" * 64, "stepId": action, "resourceId": resource, "toolName": TOOLS[action], "expectedResourceVersion": self.runtime.load("workspace_test", incident)["resourceVersions"][resource], "targetRevision": 17 if action == "rollback" else 18 if action == "fallback" and not compensation else 19, "argumentsDigest": digest(args), "compensation": compensation, "arguments": args}

    def execute(self, action, args, incident="inc_success", compensation=False):
        """执行单个有审计的操作 / Execute one audited operation."""
        return self.runtime.action(action, self.request(action, args, incident, compensation))

    def recover(self, incident="inc_success", trials=12):
        """完整运行数据、训练、评估和发布 / Run data repair, training, evaluation, and release end to end."""
        deployment = {"deploymentUid": "deploy_risk_prod"}
        self.execute("fallback", deployment | {"featureSetUid": "feature_set_risk_fallback_v1", "reasonCode": "UPSTREAM_SDK_CONTRACT_DRIFT"}, incident)
        self.execute("backfill", {"assetUid": "asset_risk_features_prod", "workflowInstanceUid": "task_risk_features_latest", "historyMonths": 36, "targetSchemaVersion": "2026.08.11-fixed", "outputDatasetUid": "dataset_risk_repaired_19"}, incident)
        started = time.perf_counter()
        self.execute("train", deployment | {"datasetUid": "dataset_risk_repaired_19", "experimentUid": "experiment_risk_19", "targetRevision": 19, "trialCount": trials, "architectures": ["LightGBM", "WideAndDeep"], "mode": "RETRAIN"}, incident)
        duration = time.perf_counter() - started
        self.execute("evaluate", deployment | {"experimentUid": "experiment_risk_19", "targetRevision": 19, "testDatasetRef": "dataset_risk_probe", "minimumSharpeImprovement": 0, "maximumDrawdownIncrease": 0}, incident)
        self.execute("register", deployment | {"experimentUid": "experiment_risk_19", "targetRevision": 19, "modelCardUid": "modelcard_risk_19"}, incident)
        self.execute("canary", deployment | {"targetRevision": 19, "trafficPercent": 5, "environment": "CANARY", "observationMinutes": 30}, incident)
        self.execute("promote", deployment | {"targetRevision": 19, "trafficPercent": 100, "environment": "CANARY"}, incident)
        self.execute("fallback-remove", deployment | {"featureSetUid": "feature_set_risk_fallback_v1", "targetRevision": 19}, incident)
        return duration

    def test_actual_success_and_restart(self):
        """验证12次实训、独立采样与重启后模型 / Verify twelve real trials, independent sampling, and models after restart."""
        initial = self.initialize()["data"]
        self.assertEqual(initial["baselineProbe"]["errorRate"], 1)
        elapsed = self.recover()
        result = self.runtime.read("workspace_test", "inc_success")["data"]
        self.assertEqual(len(result["training"]["trials"]), 12)
        self.assertEqual({x["architecture"] for x in result["training"]["trials"]}, {"LightGBM", "WideAndDeep"})
        self.assertEqual(result["training"]["trainRows"], 800)
        self.assertEqual(result["dataset"]["outputRows"], 1152)
        self.assertEqual(result["dataset"]["timeRange"], {"from": "2023-10", "to": "2026-09"})
        self.assertTrue(result["latestProbe"]["businessRecovered"])
        self.assertEqual(result["latestProbe"]["routeCounts"], {"19": 192})
        self.assertTrue(result["deployment"]["canary"]["compressedWindow"])
        self.assertGreater(result["deployment"]["canary"]["routeCounts"]["19"], 0)
        self.assertEqual(result["baselineProbe"]["errorRate"], 1)
        self.assertEqual(result["deployment"]["activeModelDigest"], file_digest(self.root / "workspace_test" / "inc_success" / "candidate-19.json"))
        self.runtime.close()
        self.runtime = FeatureDriftRuntime(self.root)
        probe = self.runtime.read("workspace_test", "inc_success", "probe")["data"]
        self.assertTrue(probe["passed"])
        self.assertEqual(probe["errorRate"], 0)
        print(json.dumps({"actual12TrialSeconds": round(elapsed, 3), "candidateAccuracy": probe["accuracy"], "p95Ms": probe["p95Ms"], "sourceMode": probe["sourceMode"]}))

    def test_actual_failure_then_exact_rollback(self):
        """验证真实输入故障及精确v17回滚 / Verify actual input failure and exact revision-17 rollback."""
        self.initialize("inc_failure", "post_release_contract")
        self.recover("inc_failure", 2)
        failed = self.runtime.read("workspace_test", "inc_failure", "probe")["data"]
        self.assertFalse(failed["passed"])
        self.assertEqual(failed["errorRate"], 1)
        self.execute("rollback", {"deploymentUid": "deploy_risk_prod", "targetRevision": 17, "verificationPolicy": {"maxErrorRate": 0.05, "maxP95Ms": 300}}, "inc_failure", True)
        final = self.runtime.read("workspace_test", "inc_failure")["data"]
        self.assertEqual(final["deployment"]["activeRevision"], 17)
        self.assertEqual(final["compensation"]["status"], "SUCCEEDED")
        self.assertFalse(final["compensation"]["originalRecoveryGoalMet"])
        self.assertFalse(final["latestProbe"]["businessRecovered"])
        self.assertEqual(final["latestProbe"]["routeCounts"], {"17": 192})
        self.assertEqual(final["deployment"]["activeModelDigest"], file_digest(self.root / "workspace_test" / "inc_failure" / "stable-17.json"))

    def test_governance_idempotency_isolation_dry_run(self):
        """检查幂等、隔离、版本和无写预检 / Check idempotency, isolation, versions, and write-free previews."""
        self.initialize()
        self.initialize("inc_other")
        args = {"deploymentUid": "deploy_risk_prod", "featureSetUid": "feature_set_risk_fallback_v1", "reasonCode": "UPSTREAM_SDK_CONTRACT_DRIFT"}
        request = self.request("fallback", args)
        before_files = {str(path): file_digest(path) for path in self.root.rglob("*.json")}
        preview = self.runtime.action("fallback", request | {"dryRun": True})
        self.assertTrue(preview["data"]["dryRun"])
        self.assertEqual(before_files, {str(path): file_digest(path) for path in self.root.rglob("*.json")})
        self.assertFalse(self.runtime.load("workspace_test", "inc_success")["deployment"]["fallbackFeatureActive"])
        response = self.runtime.action("fallback", request)
        self.assertEqual(response, self.runtime.action("fallback", request | {"requestId": "new_request"}))
        with self.assertRaisesRegex(RuntimeErrorResponse, "different parameters"):
            self.runtime.action("fallback", request | {"targetRevision": 21})
        with self.assertRaisesRegex(RuntimeErrorResponse, "version differs"):
            self.runtime.action("fallback", request | {"idempotencyKey": "stale_request"})
        altered = self.request("fallback", args) | {"argumentsDigest": "f" * 64}
        with self.assertRaisesRegex(RuntimeErrorResponse, "digest differs"):
            self.runtime.action("fallback", altered)
        self.assertFalse(self.runtime.load("workspace_test", "inc_other")["deployment"]["fallbackFeatureActive"])
        with self.assertRaises(RuntimeErrorResponse):
            self.runtime.read("workspace_other", "inc_success")

    def test_http_roles_scopes_and_no_get_creation(self):
        """验证HTTP鉴权与GET不创建 / Verify HTTP authorization and non-creating GET requests."""
        tokens = [{"token": "i" * 40, "role": "initializer", "workspaceIds": ["workspace_test"]}, {"token": "r" * 40, "role": "resident", "workspaceIds": ["workspace_test"]}]
        server = create_server(self.runtime, tokens, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = "http://127.0.0.1:" + str(server.server_address[1])
        try:
            with urllib.request.urlopen(origin + "/health") as response:
                self.assertEqual(response.status, 200)
            with self.assertRaises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(origin + "/v1/incidents")
            self.assertEqual(denied.exception.code, 401)
            request = urllib.request.Request(origin + "/v1/incidents/inc_missing?workspaceId=workspace_test", headers={"X-Feature-Drift-Token": "r" * 40})
            with self.assertRaises(urllib.error.HTTPError) as missing:
                urllib.request.urlopen(request)
            self.assertEqual(missing.exception.code, 404)
            body = json.dumps({"workspaceId": "workspace_test", "traceId": "trace_test", "idempotencyKey": "init_test", "arguments": {}}).encode()
            denied_request = urllib.request.Request(origin + "/v1/incidents/inc_new/actions/initialize", data=body, headers={"X-Feature-Drift-Token": "r" * 40, "Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError) as denied_write:
                urllib.request.urlopen(denied_request)
            self.assertEqual(denied_write.exception.code, 403)
            self.assertEqual(self.runtime.list_runs(["workspace_test"])["data"]["total"], 0)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
