#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Copyright (C) 2026 Synapxnet. All rights reserved.
# This file is Synapxnet Proprietary and Confidential. It is strictly
# forbidden to copy, distribute, or use without explicit authorization.
"""安装版冻结计划跨语言联调 / Cross-language check against the installed frozen plan.
Author: maoyo | Department: 研发部 | Date: 2026-09-18
Version: 1.3.0 | Security Level: INTERNAL
"""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from runtime import FeatureDriftRuntime, digest

__version__ = "1.3.0"
__author__ = "maoyo"
__copyright__ = "Copyright 2026 Synapxnet"
__maintainer__ = "maoyo"
__email__ = "synapxnet@gmail.com"

SCRIPT = Path(__file__).with_name("installed_contract.cjs")
ACTIONS = {"mlops.feature.fallback.apply": "fallback", "dataops.feature.backfill.start": "backfill", "mlops.training.search.start": "train", "mlops.model.evaluation.run": "evaluate", "mlops.model.register": "register", "mlops.deployment.canary.apply": "canary", "mlops.deployment.promote": "promote", "mlops.feature.fallback.remove": "fallback-remove", "mlops.deployment.rollback": "rollback"}
READS = {"dataops.dataset.validation.get": "dataset", "aiops.inference.recovery.status": "probe", "mlops.inference.probe": "probe", "mlops.deployment.get": "deployment", "mlops.release.validation.get": "deployment"}


def installed_check(payload):
    """调用安装包原始判定逻辑 / Invoke the original installed decision logic."""
    result = subprocess.run(["node", str(SCRIPT), "check"], input=json.dumps(payload), capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(result.stdout)


def installed_bind(evidence):
    """调用安装版调查聚合及动态版本绑定 / Invoke installed investigation aggregation and dynamic version binding."""
    result = subprocess.run(["node", str(SCRIPT), "bind"], input=json.dumps({"evidence": evidence}), capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(result.stdout)


class InstalledPlanTest(unittest.TestCase):
    """使用真实冻结参数，禁止手工修正测试输入 / Use frozen parameters without hand-correcting test inputs."""

    @classmethod
    def setUpClass(cls):
        """读取已安装程序的实际计划 / Read the installed application's actual plan."""
        cls.installed = json.loads(subprocess.run(["node", str(SCRIPT)], capture_output=True, text=True, encoding="utf-8", check=True).stdout)

    def run_plan(self, fault):
        """按安装版顺序执行并使用安装版质量门 / Execute installed steps and use installed quality gates."""
        with tempfile.TemporaryDirectory() as directory:
            runtime = FeatureDriftRuntime(Path(directory))
            incident = "inc_installed_failure" if fault != "none" else "inc_installed_success"
            context = {"workspaceId": "workspace_installed", "incidentId": incident, "traceId": "trace_" + incident, "actorId": "executor_test"}
            try:
                runtime.action("initialize", context | {"requestId": "initialize", "idempotencyKey": "initialize", "arguments": {"failureMode": fault, "rollbackRevision": 17}})
                # 真实读取版本再调用安装版聚合；不能把未绑定模板当作 Live 计划。
                # Read actual versions before installed aggregation; an unbound template is not a Live plan.
                investigation = []
                for tool, view in [("aiops.alert.get", "evidence"), ("dataops.schema.snapshot.get", "evidence"), ("mlops.deployment.get", "deployment")]:
                    response = runtime.read(context["workspaceId"], incident, view, {"toolName": tool})
                    investigation.append({"toolName": tool, "response": {"success": True, "data": response["data"]}})
                bound = installed_bind(investigation)
                plan = bound["profile"]["executionPlan"]
                self.assertEqual(plan["compensationSteps"][0]["expectedResourceVersion"], "44", "Live rollback must include both parent deployment transitions")
                for step in plan["steps"]:
                    if step["toolName"] in ACTIONS:
                        body = context | {key: step[key] for key in ["toolName", "stepId", "resourceId", "targetRevision", "expectedResourceVersion", "arguments"]} | {"requestId": step["stepId"], "idempotencyKey": step["stepId"], "approvalId": "approved_test_plan", "planId": plan["planId"], "planDigest": digest(plan), "argumentsDigest": digest(step["arguments"]), "compensation": False}
                        if step["kind"] != "WRITE":
                            for key in ["approvalId", "planId", "planDigest", "stepId", "resourceId", "targetRevision", "expectedResourceVersion", "argumentsDigest", "compensation"]:
                                body[key] = None
                        response = runtime.action(ACTIONS[step["toolName"]], body)
                        if step["kind"] == "WRITE":
                            self.assertEqual(response["actionReceipt"]["beforeResourceVersion"], step["expectedResourceVersion"])
                            self.assertEqual(response["resourceVersion"], str(int(step["expectedResourceVersion"]) + 1))
                    else:
                        response = runtime.read(context["workspaceId"], incident, READS[step["toolName"]])
                    self.assertTrue(installed_check({"kind": "gate", "step": step, "data": response["data"]})["passed"], step["stepId"])
                results = [{"adapterRequest": {"toolName": call["toolName"]}, "response": runtime.read(context["workspaceId"], incident, READS[call["toolName"]], call["arguments"])} for call in self.installed["profile"]["verificationCalls"]]
                verified = installed_check({"kind": "verification", "results": results})
                if fault == "none":
                    self.assertTrue(verified["passed"], verified)
                else:
                    self.assertEqual(verified.get("code"), "VERIFICATION_FAILED")
                    for step in plan["compensationSteps"]:
                        body = context | {key: step[key] for key in ["toolName", "stepId", "resourceId", "targetRevision", "expectedResourceVersion", "arguments"]} | {"requestId": step["stepId"], "idempotencyKey": step["stepId"], "approvalId": "approved_test_plan", "planId": plan["planId"], "planDigest": digest(plan), "argumentsDigest": digest(step["arguments"]), "compensation": True}
                        response = runtime.action(ACTIONS[step["toolName"]], body)
                        self.assertEqual(response["actionReceipt"]["beforeResourceVersion"], step["expectedResourceVersion"])
                        self.assertEqual(response["resourceVersion"], str(int(step["expectedResourceVersion"]) + 1))
                    final = runtime.read(context["workspaceId"], incident)["data"]
                    self.assertEqual(final["deployment"]["activeRevision"], self.installed["scenario"]["rollbackRevision"])
                    self.assertEqual(final["compensation"]["status"], "SUCCEEDED")
                final = runtime.read(context["workspaceId"], incident)["data"]
                return {"installedAsarSha256": self.installed["archiveSha256"], "failureMode": fault,
                        "planBinding": "INSTALLED_LIVE_INVESTIGATION_RESOURCE_VERSIONS",
                        "rollbackExpectedResourceVersion": plan["compensationSteps"][0]["expectedResourceVersion"], "verification": verified,
                        "datasetRows": final["dataset"]["outputRows"], "activeRevision": final["deployment"]["activeRevision"],
                        "phase": final["phase"], "compensationStatus": (final.get("compensation") or {}).get("status"),
                        "originalRecoveryGoalMet": (final.get("compensation") or {}).get("originalRecoveryGoalMet"),
                        "parentDeploymentVersion": final["resourceVersions"]["deploy_risk_prod"],
                        "fallbackVersion": final["resourceVersions"]["deploy_risk_prod/feature-set"]}
            finally:
                runtime.close()

    def test_installed_success(self):
        """安装版计划成功分支可被原验证器关闭 / The installed success plan passes its original verifier."""
        print(json.dumps(self.run_plan("none")))

    def test_installed_failure_compensation(self):
        """安装版失败分支执行原批准补偿 / The installed failure branch executes the originally approved compensation."""
        print(json.dumps(self.run_plan("post_release_contract")))


if __name__ == "__main__":
    unittest.main(verbosity=2)
