export const DEEPSEEK_SOURCE = 'deepseek';
export const DEFAULT_TARGET_MODELS = Object.freeze([
    'deepseek-flash',
    'deepseek-v4-flash',
]);

export const PREFILL_LIMIT = 16000;

/**
 * Checks whether the request can safely receive a native DeepSeek thinking prefill.
 * @param {Record<string, any>} requestData SillyTavern Chat Completions request
 * @param {Record<string, any>} settings Extension settings
 * @returns {{eligible: boolean, code: string}}
 */
export function evaluateRequest(requestData, settings) {
    if (!settings?.enabled) {
        return { eligible: false, code: 'disabled' };
    }

    const thinkingPrefill = String(settings.thinkingPrefill ?? '');
    if (!thinkingPrefill.trim()) {
        return { eligible: false, code: 'empty-prefill' };
    }

    if (thinkingPrefill.length > PREFILL_LIMIT) {
        return { eligible: false, code: 'prefill-too-long' };
    }

    if (requestData?.chat_completion_source !== DEEPSEEK_SOURCE) {
        return { eligible: false, code: 'different-source' };
    }

    if (String(requestData?.reverse_proxy ?? '').trim()) {
        return { eligible: false, code: 'reverse-proxy' };
    }

    const model = String(requestData?.model ?? '').trim().toLowerCase();
    if (!model || !DEFAULT_TARGET_MODELS.includes(model)) {
        return { eligible: false, code: 'different-model' };
    }

    if (!Array.isArray(requestData?.messages) || requestData.messages.length === 0) {
        return { eligible: false, code: 'missing-messages' };
    }

    const hasTools = Array.isArray(requestData.tools) && requestData.tools.length > 0;
    const hasToolMessages = requestData.messages.some(message =>
        message?.role === 'tool' || (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0));
    if (hasTools || hasToolMessages) {
        return { eligible: false, code: 'tools-active' };
    }

    return { eligible: true, code: 'ready' };
}

/**
 * Adds the exact native DeepSeek Chat Prefix Completion fields to the final assistant message.
 * The supplied object is SillyTavern's per-request data and is modified in place.
 * @param {Record<string, any>} requestData SillyTavern Chat Completions request
 * @param {Record<string, any>} settings Extension settings
 * @returns {{applied: boolean, code: string, model?: string}}
 */
export function applyThinkingPrefill(requestData, settings) {
    const eligibility = evaluateRequest(requestData, settings);
    if (!eligibility.eligible) {
        return { applied: false, code: eligibility.code };
    }

    let finalMessage = requestData.messages.at(-1);
    if (finalMessage?.role !== 'assistant') {
        finalMessage = {
            role: 'assistant',
            content: '',
        };
        requestData.messages.push(finalMessage);
    } else if (finalMessage.content === undefined || finalMessage.content === null) {
        finalMessage.content = '';
    }

    finalMessage.reasoning_content = String(settings.thinkingPrefill);
    finalMessage.prefix = true;
    requestData.include_reasoning = true;

    return {
        applied: true,
        code: 'applied',
        model: String(requestData.model),
    };
}
