# Commands Overview

UltraForce uses a command system to filter and control searches.

## Command Syntax

Commands start with `:` followed by a key and optional query:

```
:[command] [query]
```

## Built-in Commands

| Command | Description | Types |
|---------|-------------|-------|
| `:o` | Objects & Fields | CustomObject, CustomField |
| `:c` | Code | ApexClass, ApexTrigger, ApexPage, ApexComponent, Aura, LWC |
| `:f` | Flows | Flow |
| `:u` | Users | User |
| `:p` | Permissions | Profile, PermissionSet, PermissionSetGroup, CustomPermission |
| `:l` | Labels | CustomLabel |
| `:m` | Metadata | CustomMetadata, CustomSetting |
| `:q` | Queues | Queue, Group |
| `:r` | Reports & Dashboards | Report, Dashboard |
| `:g` | Setup | Navigate to Setup pages |

## Usage Examples

```
:o Account        # Search Account object
:c Helper         # Search classes with "Helper"
:u john           # Search users named "john"
:f approval       # Search approval flows
:g users          # Go to Users setup
```

## Scope Picker and Chips / 范围选择器和范围标签 {#scope-picker-and-chips}

Type a recognized command followed by a space, for example `:f` then Space. It becomes a compact **Flows** scope chip. Hover over the chip for the full description. Type your query beside the chip, or press `Backspace` with the search text empty to remove it.

输入有效命令并按空格，例如输入 `:f` 后按空格，即可将其转换为简短的 **流程** 范围标签。将鼠标悬停在标签上可查看完整说明。在标签旁输入搜索词，或在搜索文本为空时按 `Backspace` 移除标签。

With the search text empty, press `Tab` to open the scope picker. The left column lists available commands and the right column describes the highlighted command and what it searches. Type to filter by name, description, or command key, use Up or Down to move through the list, and press `Enter` to apply the highlighted scope. Press `Esc` or `Tab` to go back. When you have search text, `Tab` autocompletes the current result where supported.

搜索文本为空时，按 `Tab` 打开范围选择器。左栏列出可用命令，右栏显示当前高亮命令的说明和搜索内容。输入文字可按名称、说明或命令键筛选，用上下方向键浏览，再按 `Enter` 应用当前范围。按 `Esc` 或 `Tab` 返回。有搜索文本时，按 `Tab` 可自动补全支持此操作的当前结果。

## Custom Commands

Create your own commands in Settings to filter by specific metadata types.

See [Custom Commands](./custom) for details.

## Command Hints

When you type `:`, UltraForce shows available commands. Keep typing the command key to narrow the hints, then press Space after a recognized command to apply its scope.

输入 `:` 时，UltraForce 会显示可用命令。继续输入命令键可筛选提示，输完有效命令后按空格即可应用其范围。

```
:           # Shows all commands
:c          # Shows :c command details
:co         # Filters to commands starting with "co"
```
