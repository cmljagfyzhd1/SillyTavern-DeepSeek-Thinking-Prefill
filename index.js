import {
    eventSource,
    event_types,
    saveSettingsDebounced,
} from '/script.js';
import {
    extension_settings,
    renderExtensionTemplateAsync,
} from '/scripts/extensions.js';
import {
    chat_completion_sources,
    getChatCompletionModel,
    oai_settings,
} from '/scripts/openai.js';
import {
    applyThinkingPrefill,
    DEFAULT_TARGET_MODELS,
    PREFILL_LIMIT,
} from './prefill-core.js';

const MODULE_NAME = 'deepseekThinkingPrefill';
const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    thinkingPrefill: '',
});

let lastRequestResult = null;

/**
 * Returns the extension path used by SillyTavern's template loader.
 * Link installs use the repository name as the folder name, while manual
 * installs may use a custom name, so the path must be derived at runtime.
 * @returns {string}
 */
function getModulePath() {
    const scriptUrl = new URL(import.meta.url);
    const extensionRoot = '/scripts/extensions/';
    const rootIndex = scriptUrl.pathname.lastIndexOf(extensionRoot);

    if (rootIndex === -1) {
        throw new Error('Unable to determine the DeepSeek Thinking Prefill extension path.');
    }

    const encodedPath = scriptUrl.pathname.slice(rootIndex + extensionRoot.length);
    const modulePath = encodedPath.split('/').slice(0, -1).join('/');
    return decodeURIComponent(modulePath);
}

function loadSettings() {
    const savedSettings = extension_settings[MODULE_NAME];
    if (!savedSettings || typeof savedSettings !== 'object' || Array.isArray(savedSettings)) {
        extension_settings[MODULE_NAME] = structuredClone(DEFAULT_SETTINGS);
        return;
    }

    if (typeof savedSettings.enabled !== 'boolean') {
        savedSettings.enabled = DEFAULT_SETTINGS.enabled;
    }
    if (typeof savedSettings.thinkingPrefill !== 'string') {
        savedSettings.thinkingPrefill = DEFAULT_SETTINGS.thinkingPrefill;
    }

    delete savedSettings.targetModels;
}

function getSettings() {
    return extension_settings[MODULE_NAME];
}

function setStatus(message, state = 'neutral') {
    const statusElement = document.getElementById('deepseek-thinking-prefill-status');
    if (!statusElement) {
        return;
    }
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

function refreshCharacterCount() {
    const input = document.getElementById('deepseek-thinking-prefill-text');
    const counter = document.getElementById('deepseek-thinking-prefill-count');
    if (!(input instanceof HTMLTextAreaElement) || !counter) {
        return;
    }
    counter.textContent = `${input.value.length.toLocaleString()} / ${PREFILL_LIMIT.toLocaleString()}`;
}

function refreshStatus() {
    const settings = getSettings();
    if (!settings.enabled) {
        setStatus('已停用。', 'neutral');
        return;
    }

    if (!settings.thinkingPrefill.trim()) {
        setStatus('請先輸入 Thinking 預填內容。', 'neutral');
        return;
    }

    if (settings.thinkingPrefill.length > PREFILL_LIMIT) {
        setStatus('預填內容過長，請縮短後再試。', 'warning');
        return;
    }

    if (oai_settings.chat_completion_source !== chat_completion_sources.DEEPSEEK) {
        setStatus('目前連線不會套用此功能。', 'neutral');
        return;
    }

    if (String(oai_settings.reverse_proxy ?? '').trim()) {
        setStatus('目前使用了反向代理，請求會保持原樣。', 'warning');
        return;
    }

    const model = String(getChatCompletionModel(oai_settings) ?? '').trim();
    if (!DEFAULT_TARGET_MODELS.includes(model.toLowerCase())) {
        setStatus(`目前模型 ${model || '（未選擇）'} 不支援此功能。`, 'warning');
        return;
    }

    if (lastRequestResult?.applied && lastRequestResult.model === model) {
        setStatus(`已套用至最近一次 ${model} 請求。`, 'ready');
        return;
    }

    setStatus(`已就緒，將套用至 ${model}。`, 'ready');
}

function describeSkippedRequest(code) {
    switch (code) {
        case 'tools-active':
            return ['工具呼叫已啟用，本次請求保持原樣。', 'warning'];
        case 'reverse-proxy':
            return ['目前使用了反向代理，本次請求保持原樣。', 'warning'];
        case 'different-model':
            return ['目前模型不在允許清單，本次請求保持原樣。', 'warning'];
        case 'prefill-too-long':
            return ['預填內容過長，本次請求保持原樣。', 'warning'];
        default:
            return null;
    }
}

function onChatCompletionSettingsReady(requestData) {
    const result = applyThinkingPrefill(requestData, getSettings());
    lastRequestResult = result;

    if (result.applied) {
        console.debug(`[DeepSeek Thinking Prefill] Applied to model ${result.model}.`);
        setStatus(`已套用至本次 ${result.model} 請求。`, 'ready');
        return;
    }

    const skippedDescription = describeSkippedRequest(result.code);
    if (skippedDescription) {
        setStatus(...skippedDescription);
    } else {
        refreshStatus();
    }
}

function bindSettings() {
    const settings = getSettings();
    const enabledInput = document.getElementById('deepseek-thinking-prefill-enabled');
    const prefillInput = document.getElementById('deepseek-thinking-prefill-text');

    if (!(enabledInput instanceof HTMLInputElement)
        || !(prefillInput instanceof HTMLTextAreaElement)) {
        throw new Error('DeepSeek Thinking Prefill settings UI is incomplete.');
    }

    enabledInput.checked = settings.enabled;
    prefillInput.value = settings.thinkingPrefill;

    enabledInput.addEventListener('change', () => {
        settings.enabled = enabledInput.checked;
        lastRequestResult = null;
        saveSettingsDebounced();
        refreshStatus();
    });

    prefillInput.addEventListener('input', () => {
        settings.thinkingPrefill = prefillInput.value;
        lastRequestResult = null;
        saveSettingsDebounced();
        refreshCharacterCount();
        refreshStatus();
    });

    refreshCharacterCount();
    refreshStatus();
}

export async function init() {
    loadSettings();

    if (!document.getElementById('deepseek-thinking-prefill-settings')) {
        const settingsHtml = await renderExtensionTemplateAsync(getModulePath(), 'settings');
        document.getElementById('extensions_settings2')?.insertAdjacentHTML('beforeend', settingsHtml);
    }

    bindSettings();
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
    eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, refreshStatus);
    eventSource.on(event_types.CHATCOMPLETION_MODEL_CHANGED, refreshStatus);
}
