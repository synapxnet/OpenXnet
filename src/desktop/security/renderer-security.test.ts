import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  assertSafeDownloadFilename,
  assertSafeDownloadUrl,
  assertSafeExternalUrl,
  createSecureWebPreferences,
  isAllowedApplicationNavigation,
  isAuthorizedRendererPath,
  isPathWithinRoots,
  RendererSecurityError,
  sanitizeExtensionWindowRequest,
  sanitizeRendererDownloadRequest,
} from "./renderer-security";

test("BrowserWindow preferences retain the secure baseline under unsafe overrides", () => {
  assert.deepEqual(createSecureWebPreferences({
    sandbox: false,
    webSecurity: false,
    nodeIntegration: true,
    enableRemoteModule: true,
    preload: "trusted-preload.js",
  }), {
    sandbox: true,
    webSecurity: true,
    nodeIntegration: false,
    enableRemoteModule: false,
    preload: "trusted-preload.js",
    allowRunningInsecureContent: false,
    contextIsolation: true,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
  });
  assert.equal(createSecureWebPreferences({}, { allowWebviewTag: true }).webviewTag, true);
});

test("Renderer URL policy rejects active content and credential-bearing URLs", () => {
  assert.equal(assertSafeExternalUrl("https://example.test/docs"), "https://example.test/docs");
  assert.equal(assertSafeDownloadUrl("http://127.0.0.1:8000/model.bin"), "http://127.0.0.1:8000/model.bin");
  assert.throws(
    () => assertSafeExternalUrl("javascript:alert(1)"),
    (error: unknown) => error instanceof RendererSecurityError && error.code === "UNSAFE_URL_PROTOCOL",
  );
  assert.throws(
    () => assertSafeExternalUrl("https://user:secret@example.test/"),
    (error: unknown) => error instanceof RendererSecurityError && error.code === "URL_CREDENTIALS_FORBIDDEN",
  );
  assert.throws(() => assertSafeDownloadUrl("file:///sensitive.txt"), RendererSecurityError);
});

test("Application navigation remains on trusted origins and file roots", () => {
  const staticRoot = path.resolve("static");
  assert.equal(
    isAllowedApplicationNavigation("http://127.0.0.1:3456/system", ["http://127.0.0.1:3456"]),
    true,
  );
  assert.equal(
    isAllowedApplicationNavigation("https://example.test/", ["http://127.0.0.1:3456"]),
    false,
  );
  assert.equal(
    isAllowedApplicationNavigation(new URL(`file:///${staticRoot.replace(/\\/g, "/")}/skeleton.html`).href, [], [staticRoot]),
    true,
  );
  assert.equal(isAllowedApplicationNavigation("javascript:alert(1)", [], [staticRoot]), false);
});

test("Renderer path policy accepts owned and dialog-granted paths only", () => {
  const userRoot = path.resolve("test-user-data");
  const grantedFile = path.resolve("outside", "selected.pdf");
  const grantedDirectory = path.resolve("outside", "workspace");
  assert.equal(isPathWithinRoots(path.join(userRoot, "logs", "app.log"), [userRoot]), true);
  assert.equal(isPathWithinRoots(path.resolve("outside", "secret.txt"), [userRoot]), false);
  assert.equal(
    isAuthorizedRendererPath(grantedFile, [userRoot], new Set([grantedFile]), [grantedDirectory]),
    true,
  );
  assert.equal(
    isAuthorizedRendererPath(path.join(grantedDirectory, "notes.md"), [userRoot], new Set(), [grantedDirectory]),
    true,
  );
  assert.equal(
    isAuthorizedRendererPath(path.resolve("outside", "other.txt"), [userRoot], new Set(), [grantedDirectory]),
    false,
  );
});

test("Extension and download requests are normalized and bounded", () => {
  const extension = sanitizeExtensionWindowRequest({
    url: "http://127.0.0.1:3456/extensions/demo",
    extension: {
      id: "demo",
      name: "Demo",
      transparent: true,
      width: 9_999,
      height: 100,
    },
  }, "http://127.0.0.1:3456", { width: 1_920, height: 1_080 });
  assert.deepEqual(extension, {
    url: "http://127.0.0.1:3456/extensions/demo",
    id: "demo",
    name: "Demo",
    transparent: true,
    width: 1_920,
    height: 240,
  });
  assert.throws(
    () => sanitizeExtensionWindowRequest(
      { url: "https://example.test/extension", extension: {} },
      "http://127.0.0.1:3456",
      { width: 1_920, height: 1_080 },
    ),
    RendererSecurityError,
  );
  assert.equal(assertSafeDownloadFilename("model-v1.bin"), "model-v1.bin");
  assert.throws(() => assertSafeDownloadFilename("../model.bin"), RendererSecurityError);
  assert.throws(() => assertSafeDownloadFilename("CON.txt"), RendererSecurityError);
  assert.throws(() => assertSafeDownloadFilename("model.bin."), RendererSecurityError);
  assert.deepEqual(sanitizeRendererDownloadRequest({
    url: "https://cdn.example.test/model.bin",
    filename: "model.bin",
  }), {
    url: "https://cdn.example.test/model.bin",
    filename: "model.bin",
  });
});
