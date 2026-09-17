'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../static/js/vue_methods.js'), 'utf8');
const tree = ts.createSourceFile('vue_methods.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = new Set(['handleAuthViewModeChange', 'openPasswordReset', 'submitAccountAuth', 'submitPasswordReset', 'getAuthSubmitLabel', 'getSmsButtonLabel', 'sendAccessSmsCode', 'extractAccessErrorMessage']);
const definitions = [];
function visit(node) {
  if (ts.isMethodDeclaration(node) && names.has(node.name.getText(tree))) definitions.push(node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(definitions.length, names.size, 'Every auth UI action must have a real handler');

function context() {
  const notifications = [];
  const requests = [];
  const methods = vm.runInNewContext('({' + definitions.join(',') + '})', { showNotification: (...args) => notifications.push(args) });
  const state = {
    ...methods, notifications, requests, authViewMode: 'password', authUi: { submitting: false, loggingOut: false },
    smsState: { sending: false, cooldownRemaining: 0 }, registerStep: 1,
    loginForm: { identity: '', secret: '', phone: '', code: '', password: '', confirmPassword: '' },
    isCurrentLanguageZh: () => true, ensureAccessLegalAgreementAccepted: () => true,
    getCurrentAccessLegalLocale: () => 'zh',
    async requestAccessApi(route, options) { requests.push({ route, options }); return { account: { id: 'test' } }; },
    async finalizeSuccessfulAccessAuth() { this.finalized = true; },
    submitPasswordLogin() { throw new Error('Reset must never fall through to password login'); },
  };
  return state;
}
function validDraft(state) {
  Object.assign(state.loginForm, { phone: '+15555550100', code: '123456', password: 'test-only-value', confirmPassword: 'test-only-value' });
}

test('forgot-password opens the reset form without sending a message', () => {
  const state = context();
  state.loginForm.secret = 'discarded-test-value';
  state.openPasswordReset();
  assert.equal(state.authViewMode, 'reset');
  assert.equal(state.smsState.purpose, 'reset_password');
  assert.equal(state.loginForm.secret, '');
  assert.match(state.getAuthSubmitLabel(), /重设/);
  assert.match(state.getSmsButtonLabel('reset_password'), /重设/);
  assert.equal(state.requests.length, 0);
});

test('reset refuses incomplete or mismatched drafts before any request', async () => {
  const state = context();
  for (const override of [{ phone: '' }, { code: '' }, { password: 'short', confirmPassword: 'short' }, { confirmPassword: 'mismatch' }]) {
    validDraft(state);
    Object.assign(state.loginForm, override);
    await state.submitPasswordReset();
  }
  assert.equal(state.requests.length, 0);
  assert.equal(state.notifications.length, 4);
});

test('reset honors legal consent before submitting', async () => {
  const state = context();
  validDraft(state);
  state.ensureAccessLegalAgreementAccepted = () => false;
  await state.submitPasswordReset();
  assert.equal(state.requests.length, 0);
});

test('reset submits the supported reset contract and preserves password bytes', async () => {
  const state = context();
  validDraft(state);
  state.authViewMode = 'reset';
  state.loginForm.password = state.loginForm.confirmPassword = ' test-only-value ';
  await state.submitAccountAuth();
  assert.equal(state.requests.length, 1);
  const { route, options } = state.requests[0];
  assert.equal(route, '/v1/access/auth/password/reset');
  assert.equal(options.method, 'POST');
  assert.equal(options.body.new_password, ' test-only-value ');
  assert.equal(options.body.code, '123456');
  assert.equal(options.retryOnUnauthorized, false);
  assert.equal(state.finalized, true);
  assert.equal(state.authUi.submitting, false);
});

test('reset failure leaves the account unauthenticated and permits a retry', async () => {
  const state = context();
  validDraft(state);
  state.requestAccessApi = async () => { throw new Error('Verification rejected'); };
  await state.submitPasswordReset();
  assert.equal(state.finalized, undefined);
  assert.equal(state.authUi.submitting, false);
  assert.equal(state.notifications.at(-1)[1], 'error');
});

test('active requests and SMS cooldown prevent duplicate operations', async () => {
  const state = context();
  validDraft(state);
  state.authUi.submitting = true;
  await state.submitPasswordReset();
  state.smsState.cooldownRemaining = 30;
  await state.sendAccessSmsCode('reset_password');
  state.smsState.cooldownRemaining = 0;
  state.smsState.sending = true;
  await state.sendAccessSmsCode('reset_password');
  assert.equal(state.requests.length, 0);
});

test('credential failures have a readable localized message', () => {
  const state = context();
  assert.equal(state.extractAccessErrorMessage('Invalid credentials'), '手机号或密码错误');
  assert.equal(state.extractAccessErrorMessage({ detail: 'Invalid credentials' }), '手机号或密码错误');
  state.isCurrentLanguageZh = () => false;
  assert.equal(state.extractAccessErrorMessage('Invalid credentials'), 'Invalid credentials');
});
