import assert from 'node:assert/strict';
import {
    applyThinkingPrefill,
    evaluateRequest,
} from '../prefill-core.js';

const settings = {
    enabled: true,
    thinkingPrefill: 'Check the request and key assumptions first.',
};

const requestData = {
    chat_completion_source: 'deepseek',
    model: 'deepseek-flash',
    messages: [{ role: 'user', content: 'Answer this question.' }],
    include_reasoning: false,
};

const result = applyThinkingPrefill(requestData, settings);
assert.equal(result.applied, true);
assert.equal(requestData.include_reasoning, true);
assert.deepEqual(requestData.messages.at(-1), {
    role: 'assistant',
    content: '',
    reasoning_content: settings.thinkingPrefill,
    prefix: true,
});

const protectedCases = [
    {
        code: 'different-source',
        request: { ...requestData, chat_completion_source: 'openai', messages: [{ role: 'user', content: 'test' }] },
    },
    {
        code: 'different-model',
        request: { ...requestData, model: 'deepseek-v4-pro', messages: [{ role: 'user', content: 'test' }] },
    },
    {
        code: 'reverse-proxy',
        request: { ...requestData, reverse_proxy: 'https://example.invalid', messages: [{ role: 'user', content: 'test' }] },
    },
    {
        code: 'tools-active',
        request: { ...requestData, tools: [{ type: 'function' }], messages: [{ role: 'user', content: 'test' }] },
    },
];

for (const protectedCase of protectedCases) {
    const before = structuredClone(protectedCase.request);
    const protectedResult = applyThinkingPrefill(protectedCase.request, settings);
    assert.equal(protectedResult.applied, false);
    assert.equal(protectedResult.code, protectedCase.code);
    assert.deepEqual(protectedCase.request, before);
}

assert.deepEqual(evaluateRequest(requestData, { ...settings, thinkingPrefill: '' }), {
    eligible: false,
    code: 'empty-prefill',
});

console.log('Request-shape tests passed.');
