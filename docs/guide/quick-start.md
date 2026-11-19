# Quick Start

## Open Search

Press `Cmd+B` (Mac) or `Ctrl+B` (Windows) on any Salesforce page to open UltraForce.

在任意 Salesforce 页面按 `Cmd+B`（Mac）或 `Ctrl+B`（Windows）打开 UltraForce。

The floating, pill-shaped search bar has round **History**, **Favorites**, and **Settings** buttons. As soon as you type a query or start a command, the buttons hide and the bar and panel form a single results card.

悬浮胶囊搜索栏旁有 **历史记录**、**收藏** 和 **设置** 三个圆形按钮。开始输入搜索词或命令后，按钮会隐藏，搜索栏与下方的面板合为一张结果卡片。

## Basic Search

Type any keyword to search across all metadata types:

```
AccountHelper     # Finds Apex classes, triggers, etc.
Contact           # Finds objects, fields, flows, etc.
```

## Use Commands

Type a command and a space to turn it into a scope chip, then enter your search text.

输入命令并按空格，将命令转换为范围标签，然后输入搜索词。

```
:o Account        # Objects & Fields only
:c Helper         # Code only (Apex, VF, LWC)
:u admin          # Users only
:f approval       # Flows only
```

## Scope Picker and Chips / 范围选择器和范围标签

Press `Tab` with the search text empty to open the scope picker. Type to filter the list, use the arrow keys to highlight a scope and see its details, then press `Enter` to choose it. Press `Esc` or `Tab` to return to search.

搜索文本为空时，按 `Tab` 打开范围选择器。输入文字筛选列表，用方向键选中范围并查看详情，再按 `Enter` 确认。按 `Esc` 或 `Tab` 返回搜索。

Hover over a scope chip to see its full description. Press `Backspace` when the search text is empty to remove the chip. See [Commands Overview](../commands/) for details.

将鼠标悬停在范围标签上即可查看完整说明。搜索文本为空时，按 `Backspace` 移除标签。详见[命令概览](../commands/)。

## Field Search

Use dot notation to search fields:

```
Account.          # All Account fields
Account.Name      # Account Name field
contact.email     # Case-insensitive
```

## Navigate Results

| Key / 按键 | Action / 操作 |
|---|---|
| Up / Down | Move through results / 在结果中移动 |
| `Enter` | Open the selected result / 打开所选结果 |
| `Tab` with no search text / 搜索文本为空时按 `Tab` | Open the scope picker, even if a chip is already active / 打开范围选择器，即使已有范围标签 |
| `Tab` with search text / 有搜索文本时按 `Tab` | Autocomplete the selected result where supported / 自动补全支持此操作的所选结果 |
| `Esc` | Close the scope picker or Settings if open. Otherwise, close search. / 若范围选择器或设置已打开，先关闭它。否则关闭搜索。 |

## Setup Navigation

Use `:g` command to jump to Setup pages:

```
:g setup          # Go to Setup home
:g users          # Go to Users setup
:g profiles       # Go to Profiles setup
```
