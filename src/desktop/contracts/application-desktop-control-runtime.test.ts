import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationDesktopControlActionRequest,
  parseApplicationDesktopControlHistoryRequest,
  parseApplicationDesktopControlWindowListRequest,
} from "./application-desktop-control-runtime";

test("desktop control contract accepts exact bounded requests", () => {
  assert.deepEqual(parseApplicationDesktopControlWindowListRequest({}), {
    titleQuery: "",
    includeHidden: false,
    includeMinimized: true,
    limit: 20,
  });
  assert.deepEqual(parseApplicationDesktopControlHistoryRequest({ limit: 12 }), { limit: 12 });
  assert.deepEqual(parseApplicationDesktopControlActionRequest({
    action: "snap",
    hwnd: 1234,
    payload: { position: "left", monitorIndex: null, useWorkArea: true },
  }), {
    action: "snap",
    hwnd: 1234,
    payload: { position: "left", monitorIndex: null, useWorkArea: true },
  });
});

test("desktop control contract rejects unknown actions, extra fields, and unsafe ranges", () => {
  assert.throws(() => parseApplicationDesktopControlWindowListRequest({ path: "C:\\private" }), /fields/i);
  assert.throws(() => parseApplicationDesktopControlHistoryRequest({ limit: 41 }), /limit/i);
  assert.throws(() => parseApplicationDesktopControlActionRequest({
    action: "close",
    hwnd: 1234,
    payload: {},
  }), /action/i);
  assert.throws(() => parseApplicationDesktopControlActionRequest({
    action: "move",
    hwnd: 0,
    payload: { x: 0, y: 0 },
  }), /hwnd/i);
  assert.throws(() => parseApplicationDesktopControlActionRequest({
    action: "resize",
    hwnd: 1234,
    payload: { width: 800, height: 600, command: "secret" },
  }), /fields/i);
});
