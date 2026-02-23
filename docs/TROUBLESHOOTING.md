# Troubleshooting

## CodeBuddy "Add to Chat" Not Working

### Symptom

The "Add to Chat" button in the config.md editor (next to code blocks) does nothing when clicked in Tencent CodeBuddy IDE. The chat panel may open, but the file reference (`@filename`) does not appear in the input box. Alternatively, the message may be sent immediately instead of being placed in the input for the user to edit first.

### Root Cause

CodeBuddy exposes **two different** add-to-chat commands:

| Command ID | Purpose | Parameters |
|------------|---------|------------|
| `tencentcloud.codingcopilot.addToChat` | Correct command, registered in genie extension with menus and shortcut (Ctrl+Alt+I) | `vscode.Uri` |
| `tencentcloud.codingcopilot.ide.addToChat` | Internal "All-in-One" command with a different API | Different payload format |

Using the wrong command (`tencentcloud.codingcopilot.ide.addToChat`) causes the handler to return success without any visible effect, because the command expects different arguments or context.

### Additional Pitfalls

1. **`tencentcloud.codingcopilot.chat.sendMessage`** — This command **sends** the message immediately (like pressing Enter). It is not suitable for "add to input" behavior; use it only when you want to actually send.

2. **Opening the file in a text editor** — Some add-to-chat commands read from `vscode.window.activeTextEditor`. When invoked from a custom webview, there is no active text editor, so the command can succeed but do nothing. However, the correct `tencentcloud.codingcopilot.addToChat` command **accepts a URI argument** and does not require an active editor.

3. **`workbench.action.chat.open`** — CodeBuddy does not provide this command; `chatOpen=none` in the environment.

### Fix

1. **Detect the correct command** — Check for `tencentcloud.codingcopilot.addToChat` (without `.ide.`) and **prioritize it** over `tencentcloud.codingcopilot.ide.addToChat` in the command list.

2. **Pass the file URI** — Call `executeCommand('tencentcloud.codingcopilot.addToChat', fileUri)` with a `vscode.Uri` for the target file.

3. **Fallback** — If no add-to-chat command succeeds, copy `@filename` to the clipboard and prompt the user to paste.

### Code Reference

- Command detection: `src/editor/smartMarkdownEditor.ts` → `ensureChatSupportResolved()`
- Handler: `src/editor/smartMarkdownEditor.ts` → `handleAddFileToChat()`

### Source Code Location (for future debugging)

The genie extension implementation is at:

```
<CodeBuddy installation>/resources/app/extensions/genie/out/extension/index.js
```

Key class: `AddToChatCommand` handler. It expects `(uri, uris)` where `uri` is a single `vscode.Uri` or `uris` is an array of URIs. Supported schemes: `file`, `vscode-notebook-cell`, `vscode-remote`.
