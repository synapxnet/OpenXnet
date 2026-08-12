import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApplicationKnowledgeBaseQueryRequest,
  parseApplicationKnowledgeBaseScopeRequest,
} from "./application-knowledge-base-runtime";

test("knowledge base contract accepts exact bounded requests", () => {
  assert.deepEqual(parseApplicationKnowledgeBaseScopeRequest({ knowledgeBaseId: "kb-one" }), {
    knowledgeBaseId: "kb-one",
  });
  assert.deepEqual(parseApplicationKnowledgeBaseQueryRequest({
    knowledgeBaseId: "00000000-0000-4000-8000-000000000001",
    query: "  desktop runtime  ",
    limit: 8,
  }), {
    knowledgeBaseId: "00000000-0000-4000-8000-000000000001",
    query: "desktop runtime",
    limit: 8,
  });
});

test("knowledge base contract rejects paths, extra fields, and unbounded queries", () => {
  assert.throws(() => parseApplicationKnowledgeBaseScopeRequest({
    knowledgeBaseId: "../private",
  }), /invalid/i);
  assert.throws(() => parseApplicationKnowledgeBaseScopeRequest({
    knowledgeBaseId: "kb-one",
    path: "C:\\private",
  }), /fields/i);
  assert.throws(() => parseApplicationKnowledgeBaseQueryRequest({
    knowledgeBaseId: "kb-one",
    query: " ",
  }), /query/i);
  assert.throws(() => parseApplicationKnowledgeBaseQueryRequest({
    knowledgeBaseId: "kb-one",
    query: "valid",
    limit: 21,
  }), /limit/i);
});
