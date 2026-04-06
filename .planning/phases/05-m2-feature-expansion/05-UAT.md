---
status: complete
phase: 05-m2-feature-expansion
source: Milestone 2 phases 1-4 (history-store, favorites-store, HomeScreen, IdPreview, contextual-suggestions)
started: 2026-04-06T08:00:00Z
updated: 2026-04-06T08:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Home Screen Empty State
expected: Open modal (Cmd+B) with no prior history/favorites. Shows "Start searching" with keyboard tips. No favorites or recent sections visible.
result: pass

### 2. History Tracking on Navigation
expected: Search for any metadata item (e.g., "WeatherService") and click to navigate. Re-open modal with empty query. The "Recent" section now shows the item you just visited with a relative time label (e.g., "just now") and a type badge.
result: pass

### 3. Frecency Ranking in Recent Items
expected: Navigate to several different items across multiple searches. Re-open modal with empty query. Recent items are ranked by frecency -- items visited more often AND more recently appear first. Visit the same item 3+ times, it should rise to the top.
result: pass

### 4. Remove Item from History
expected: On the home screen, hover over a recent item. An X button appears on the right. Click it. The item is removed from the recent list immediately.
result: pass

### 5. Pin Item to Favorites
expected: On the home screen's recent section, hover over an item. A star icon appears. Click the star. The item appears in the "Favorites" section at the top of the home screen with a filled star icon.
result: issue
reported: "1. Favorites section star icon only shows on hover, should be always visible. 2. In search results, clicking star icon doesn't change style - can't tell if item is favorited."
severity: minor

### 6. Unpin Item from Favorites
expected: On a pinned favorite, click the filled star icon. The item is removed from the favorites section. If no favorites remain, the favorites section disappears.
result: issue
reported: "Unpin works correctly, but HomeScreen favorite icon style is inconsistent with search results page favorite icon. Should be unified."
severity: cosmetic

### 7. Favorites Persist Across Sessions
expected: Pin 2-3 items to favorites. Close and reopen the browser tab (or refresh the Salesforce page). Open modal (Cmd+B). Favorites section still shows the pinned items.
result: pass

### 8. Smart ID Detection -- Plain ID
expected: Paste a Salesforce record ID (e.g., 001 or 005 prefix, 15 or 18 chars) into the search input. Instead of normal search results, an ID preview card appears showing the object type (e.g., "Account") and record name (e.g., "Acme Corp"). Press Enter to navigate to the record.
result: issue
reported: "Single ID preview works correctly. But users may paste multiple IDs at once -- need to extract all IDs and show them as a search result list, not just the first one."
severity: major

### 9. Smart ID Detection -- URL Paste
expected: Paste a full Salesforce URL (e.g., "https://org.lightning.force.com/lightning/r/Account/001xxx/view") into the search input. The ID is extracted from the URL and the preview card shows the resolved record name and object type.
result: pass

### 10. Smart ID Detection -- Invalid ID
expected: Paste a random 15-18 character string that is not a valid Salesforce ID (e.g., "XXXXXXXXXXXXXXXXXX"). Either no preview appears, or a clear "ID not found" / "Record not found" message is shown.
result: pass

### 11. Contextual Record Actions
expected: Navigate to any record page (e.g., an Account). Open modal (Cmd+B). Record actions section shows at least 5 actions: Sharing, History, Related Lists, Clone, Object Setup. Each action is clickable and opens the correct page.
result: issue
reported: "1. Page Layout button should not be highlighted by default. 2. Sharing, History, Related Lists URLs are all incorrect. 3. Setup button navigates to Fields instead of Details. 4. History and Related Lists are not useful -- replace with Approval, Feed Tracking, etc."
severity: major

### 12. Contextual Setup Suggestions
expected: Navigate to a Setup page (e.g., Flows). Open modal. Related setup pages in the same category are suggested (e.g., other Process Automation pages like Workflow Rules, Approval Processes).
result: pass

### 13. History Tracking from ID Navigate
expected: Paste a Salesforce ID, press Enter to navigate. Re-open modal. The record appears in the "Recent" section on the home screen.
result: pass

## Summary

total: 13
passed: 9
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Pinned favorites should show a persistent filled star icon; search results should show filled star for favorited items"
  status: failed
  reason: "User reported: 1. Favorites section star icon only shows on hover, should be always visible. 2. In search results, clicking star icon doesn't change style - can't tell if item is favorited."
  severity: minor
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Pasting multiple Salesforce IDs should show all matching records as a list, not just the first one"
  status: failed
  reason: "User reported: Single ID preview works but users may paste multiple IDs -- need to extract all IDs and show them as a search result list."
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Favorite icon style should be consistent between HomeScreen and search results page"
  status: failed
  reason: "User reported: HomeScreen favorite icon style is inconsistent with search results page favorite icon. Should be unified."
  severity: cosmetic
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Record actions should have correct URLs and useful action set"
  status: failed
  reason: "User reported: 1. Page Layout button highlighted by default (shouldn't be). 2. Sharing/History/Related Lists URLs incorrect. 3. Setup goes to Fields not Details. 4. Replace History/Related Lists with Approval, Feed Tracking, etc."
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
