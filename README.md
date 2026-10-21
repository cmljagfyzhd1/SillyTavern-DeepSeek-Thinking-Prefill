# SillyTavern DeepSeek Thinking Prefill

Adds a configurable native Thinking Prefill for the official DeepSeek Chat Completions source in SillyTavern.

The final assistant message is sent with DeepSeek's native fields:

```json
{
  "role": "assistant",
  "content": "",
  "reasoning_content": "Configured thinking prefill",
  "prefix": true
}
```

Thinking mode is enabled for matching requests. Regular text prompts are not added.

## Install

In SillyTavern, open **Extensions → Install extension** and enter:

```text
https://github.com/cmljagfyzhd1/SillyTavern-DeepSeek-Thinking-Prefill
```

Reload SillyTavern, then open **Extensions → DeepSeek Thinking Prefill** and enter the desired prefill.

## Scope

The extension only modifies requests that meet all of these conditions:

- The Chat Completions source is the official DeepSeek source.
- The model is `deepseek-flash` or the compatible legacy alias `deepseek-v4-flash`.
- No reverse proxy is configured.
- Tool calling is inactive.

Other providers and models remain unchanged. API keys are never read or stored by this extension.

## Disable

Turn off **Enable native Thinking Prefill** in the extension settings, or disable the extension from SillyTavern's extension manager.
