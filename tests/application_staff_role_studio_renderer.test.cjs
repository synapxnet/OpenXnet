const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/** 读取仓库内 UTF-8 文本；输入相对路径，返回文件内容。 */
function readProjectFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

/** 验证紧凑角色卡、GOAI 快捷角色和单层滚动弹窗契约。 */
test("staff role studio keeps the compact GOAI quick-create contract", () => {
  const html = readProjectFile("static/index.html");
  const data = readProjectFile("static/js/vue_data.js");
  const methods = readProjectFile("static/js/vue_methods.js");
  const styles = readProjectFile("static/css/staff-role-studio-compact.css");

  assert.ok(
    html.indexOf("css/staff-role-studio-compact.css") > html.indexOf("css/enterprise-3d.css"),
    "紧凑角色卡样式必须在旧版 3D 样式之后加载。",
  );
  assert.match(html, /v-for="shortcut in goaiStaffRoleShortcuts"/u);
  assert.match(html, /@click="createStaffFromGoaiShortcut\(shortcut\)"/u);
  assert.match(html, /staff-role-template-card__skill-count/u);
  assert.match(html, /staff-role-dialog__identity-row/u);
  assert.match(html, /staff-role-dialog__workspace/u);
  assert.match(html, /staff-role-dialog__titlebar/u);
  assert.match(html, /newStaffRole\.name \|\| \(isCurrentLanguageZh\(\) \? '未命名角色'/u);
  assert.match(html, /staff-role-icon-option-check/u);
  assert.match(html, /staff-role-dialog__action-icon/u);
  assert.match(html, /staff-role-form-chips" :class="\{ 'is-empty'/u);
  assert.match(html, /:aria-pressed="\(newStaffRole\.icon \|\| defaultStaffRoleIcon\) === option\.value"/u);
  assert.match(data, /id: 'goai-incident-commander'/u);
  assert.match(data, /id: 'goai-evidence-agent'/u);
  assert.match(data, /id: 'goai-verification-agent'/u);
  assert.match(methods, /createStaffFromGoaiShortcut\(shortcut = \{\}\)/u);
  assert.match(methods, /enterprise-workspaces'[\s\S]*?await this\.loadWorkspaceEnvs\(\)/u);
  assert.match(methods, /mapApplicationEnterpriseWorkspaceToUi\(workspace = \{\}\)/u);
  assert.match(methods, /buildApplicationEnterpriseWorkspaceDraft\(workspace = \{\}\)/u);
  assert.match(methods, /saveApplicationEnterpriseWorkspace/u);
  assert.match(methods, /removeApplicationEnterpriseWorkspace/u);
  assert.match(styles, /container: staff-role-studio \/ inline-size/u);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(240px, 1fr\)\)/u);
  assert.match(styles, /height: 168px !important/u);
  assert.match(styles, /\.staff-role-dialog-modal \.el-overlay-dialog[\s\S]*?overflow: hidden !important/u);
  assert.match(styles, /\.staff-role-dialog \.el-dialog__body[\s\S]*?overflow: hidden/u);
  assert.match(styles, /\.staff-role-dialog \.staff-role-icon-picker[\s\S]*?width: 100%/u);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.staff-role-dialog \.el-dialog__body[\s\S]*?overflow-y: auto/u);
  assert.doesNotMatch(styles, /(?:linear|radial)-gradient/u);
});
