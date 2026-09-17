/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 会话阅读行为回归 / Conversation reading behavior regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationScopeKey, isNearLatest, messageScrollOffset, shouldFollowLatest } from './conversationViewport.js';

test('a reader revisiting history is not pulled down by each streamed chunk', () => {
  const reading = { scrollHeight: 2400, scrollTop: 300, clientHeight: 700 };
  for (const nextHeight of [2400, 2470, 2660]) {
    reading.scrollHeight = nextHeight;
    assert.equal(shouldFollowLatest({ nearBottom: isNearLatest(reading) }), false);
  }
  assert.equal(shouldFollowLatest({ nearBottom: false, explicit: true }), true);
  assert.equal(shouldFollowLatest({ nearBottom: false, scopeChanged: true }), true);
});

test('short conversations and a reader at the end follow new output', () => {
  assert.equal(isNearLatest({ scrollHeight: 500, scrollTop: 0, clientHeight: 700 }), true);
  assert.equal(isNearLatest({ scrollHeight: 2100, scrollTop: 1400, clientHeight: 700 }), true);
  assert.equal(isNearLatest({ scrollHeight: 2100, scrollTop: 1310, clientHeight: 700 }), false);
});

test('draft keys distinguish projects and avoid delimiter collisions', () => {
  const draftKeys = [
    { conversationId: 'a', settings: { workspace: { path: 'x' } } },
    { conversationId: 'a', settings: { workspace: { path: 'y' } } },
    { conversationId: 'a|x', settings: { workspace: { path: 'y' } } },
    { conversationId: 'a', settings: { workspace: { path: 'x|y' } } },
    { conversationId: '', settings: { workspace: { path: 'x' } } },
  ].map(conversationScopeKey);
  assert.equal(new Set(draftKeys).size, draftKeys.length);
});

test('message navigation uses the chat viewport rather than page coordinates', () => {
  assert.equal(messageScrollOffset({ top: 120 }, { top: 450 }, 850), 1156);
  assert.equal(messageScrollOffset({ top: 120 }, { top: 100 }, 0), 0);
});
