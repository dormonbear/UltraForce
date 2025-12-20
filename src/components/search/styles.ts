export const SEARCH_MODAL_STYLES = `
  /* Font Import - using system fonts as fallback but prioritizing modern sans-serifs */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

  .ultraforce-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483646;
    pointer-events: all;
  }

  .ultraforce-search-modal {
    position: fixed;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    width: 90%;
    max-width: 720px;
    min-height: 200px;
    max-height: 80%;
    background: rgba(20, 20, 25, 0.85);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.2),
      0 20px 60px -10px rgba(0, 0, 0, 0.6),
      0 10px 20px -5px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    z-index: 2147483647;
    pointer-events: all;
    outline: none;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    color: #ffffff;
    opacity: 0;
    animation: modal-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .ultraforce-search-modal--soql {
    /* Keep the modal compact while composing a SOQL query; expand only when results are shown. */
    top: 10%;
    max-height: 80%;
  }

  .ultraforce-search-modal--soql-result {
    top: 1.5vh;
    height: 97vh;
    max-height: 97vh;
  }

  @media (max-height: 800px) {
    .ultraforce-search-modal--soql-result {
      top: 3vh;
      max-height: 96vh;
    }
  }

  @keyframes modal-fade-in {
    from { opacity: 0; transform: translate(-50%, 10px) scale(0.98); }
    to { opacity: 1; transform: translate(-50%, 0) scale(1); }
  }

  .search-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }

  /* Search Input Section */
  .search-input-section {
    display: flex;
    align-items: center;
    padding: 12px 20px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
    gap: 12px;
  }

  .search-input-section--multiline {
    align-items: flex-start;
  }

  .search-icon {
    color: rgba(255, 255, 255, 0.4);
    margin-top: 0;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .search-input-section--multiline .search-icon {
    margin-top: 2px;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none !important;
    color: #ffffff;
    font-size: 18px;
    font-weight: 400;
    outline: none !important;
    box-shadow: none !important;
    line-height: 1.3;
    letter-spacing: -0.01em;
    padding: 2px 0;
    margin: 0;
    resize: none;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .org-badge {
    margin-left: 16px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
    transition: all 0.2s ease;
    user-select: none;
    align-self: center;
    margin-top: 0;
  }

  .search-input-section--multiline .org-badge {
    align-self: flex-start;
    margin-top: 2px;
  }

  /* Production - Red warning */
  .org-badge-production {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
    animation: prod-pulse 2s ease-in-out infinite;
  }

  @keyframes prod-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.3); }
  }

  /* Sandbox - Yellow/Amber */
  .org-badge-sandbox {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #fbbf24;
  }

  /* Scratch - Blue */
  .org-badge-scratch {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }

  /* Developer - Green */
  .org-badge-developer {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }

  /* Unknown - Gray */
  .org-badge-unknown {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
  }

  .org-badge:hover {
    transform: scale(1.05);
  }

  /* Results Area */
  .search-results {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    scroll-behavior: smooth;
  }

  .search-results::-webkit-scrollbar {
    width: 10px;
  }

  .search-results::-webkit-scrollbar-track {
    background: transparent;
  }

  .search-results::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .search-results::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  /* Group Headers */
  .result-group {
    margin-bottom: 4px;
  }

  .result-group-header {
    display: flex;
    align-items: center;
    padding: 6px 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    user-select: none;
    transition: color 0.2s ease;
  }

  .result-group-header:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .group-chevron {
    margin-right: 8px;
    font-size: 10px;
    transition: transform 0.2s ease;
    opacity: 0.6;
  }

  .group-chevron.collapsed {
    transform: rotate(-90deg);
  }

  .group-count {
    margin-left: auto;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Result Items */
  .result-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px;
    cursor: pointer;
    transition: all 0.1s ease;
    border-left: 2px solid transparent;
    margin: 0 8px;
    border-radius: 6px;
  }

  .result-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .result-item.selected {
    background: rgba(59, 130, 246, 0.15);
    border-left-color: #3b82f6;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-name {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-item.selected .result-name {
    color: #ffffff;
  }

  .result-description {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-item.selected .result-description {
    color: rgba(255, 255, 255, 0.6);
  }

  .result-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .result-namespace {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .meta-user {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta-date {
    color: rgba(255, 255, 255, 0.3);
  }

  .object-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .result-item:hover .object-actions {
    opacity: 1;
  }

  .object-action-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .object-action-btn:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: #3b82f6;
  }

  .object-action-btn:active {
    transform: scale(0.95);
  }

  /* Empty States */
  .search-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    text-align: center;
    flex: 1;
    min-height: 120px;
  }

  .empty-icon {
    font-size: 36px;
    margin-bottom: 12px;
    opacity: 0.2;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  }

  .empty-title {
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 6px;
  }

  .empty-desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    max-width: 280px;
    line-height: 1.4;
  }

  /* Error State */
  .search-error .empty-title {
    color: #ef4444;
  }

  .search-error .error-message {
    color: rgba(255, 255, 255, 0.6);
    max-width: 360px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    background: rgba(239, 68, 68, 0.1);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    word-break: break-word;
  }

  .action-button {
    margin-top: 24px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
  }

  .action-button:active {
    transform: translateY(0);
  }

  /* Footer */
  .search-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
    user-select: none;
  }

  .shortcuts {
    display: flex;
    gap: 16px;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  kbd {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: inherit;
    font-size: 10px;
    min-width: 16px;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  .settings-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  /* Loading State */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Settings Overlay */
  .settings-overlay {
    position: absolute;
    inset: 0;
    background: transparent;
    z-index: 10;
    display: flex;
    flex-direction: column;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .back-button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 8px;
    margin-right: 12px;
    margin-left: -8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .settings-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .settings-content::-webkit-scrollbar {
    width: 10px;
  }

  .settings-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .settings-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .setting-section {
    margin-bottom: 32px;
  }

  .settings-meta {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .settings-meta .meta-item {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
  }

  .settings-meta .meta-link {
    color: #60a5fa;
    text-decoration: none;
  }

  .settings-meta .meta-link:hover {
    text-decoration: underline;
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-desc {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 16px 0;
    line-height: 1.5;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .type-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .type-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .type-option input:checked + .type-label {
    color: #3b82f6;
  }

  .type-checkbox {
    accent-color: #3b82f6;
    width: 16px;
    height: 16px;
  }

  .type-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  .shortcut-config {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.04);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .shortcut-display {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 16px;
    color: #fff;
  }

  .shortcut-key-select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 4px 8px;
    border-radius: 6px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    outline: none;
  }

  .shortcut-key-select:focus {
    border-color: #3b82f6;
  }

  .toggle-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .toggle-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .toggle-checkbox {
    accent-color: #3b82f6;
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
  }

  /* Command Hints */
  .command-hints {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .command-hint-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    font-size: 11px;
  }

  .command-key {
    font-family: 'SF Mono', Monaco, monospace;
    font-weight: 600;
    color: #3b82f6;
  }

  .command-desc {
    color: rgba(255, 255, 255, 0.5);
  }

  /* Commands List in Settings */
  .commands-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .command-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
  }

  .command-row .command-key {
    font-family: 'SF Mono', Monaco, monospace;
    font-weight: 600;
    color: #3b82f6;
    min-width: 28px;
  }

  .command-row .command-desc {
    color: rgba(255, 255, 255, 0.8);
    flex: 1;
  }

  .command-row .command-types {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    flex: 1;
    text-align: right;
  }

  .command-types-display {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;
  }

  .command-type-tag {
    padding: 3px 8px;
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    font-size: 11px;
    color: #60a5fa;
  }

  .command-actions {
    display: flex;
    gap: 4px;
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .command-row:hover .command-actions {
    opacity: 1;
  }

  .cmd-icon-btn {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cmd-icon-btn:hover {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .cmd-icon-btn-danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .command-edit-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .command-edit-row {
    display: flex;
    gap: 8px;
  }

  .command-input {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 10px;
    color: #fff;
    font-size: 13px;
    outline: none;
  }

  .command-input:focus {
    border-color: #3b82f6;
  }

  .command-input.input-error {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .command-input-key {
    width: 50px;
    font-family: 'SF Mono', Monaco, monospace;
    font-weight: 600;
  }

  .command-input-desc {
    flex: 1;
  }

  .command-types-select {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .command-type-option {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .command-type-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .command-type-option input {
    accent-color: #3b82f6;
  }

  .command-edit-actions {
    display: flex;
    gap: 8px;
  }

  .cmd-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
  }

  .cmd-btn-save {
    background: #3b82f6;
    color: #fff;
  }

  .cmd-btn-save:hover {
    background: #2563eb;
  }

  .cmd-btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .cmd-btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .commands-footer {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .cmd-btn-add {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .cmd-btn-add:hover {
    background: rgba(59, 130, 246, 0.25);
  }

  .cmd-btn-reset {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cmd-btn-reset:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  /* Custom Command Form Styles */
  .command-form-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .command-form-row-inline {
    display: flex;
    gap: 12px;
  }

  .command-form-row-inline .command-form-row {
    flex: 1;
  }

  .command-form-label {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .command-textarea {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 8px 10px;
    color: #fff;
    font-size: 12px;
    font-family: 'SF Mono', Monaco, monospace;
    outline: none;
    resize: vertical;
    min-height: 60px;
  }

  .command-textarea:focus {
    border-color: #3b82f6;
  }

  .command-form-hint {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
  }

  .command-form-error {
    font-size: 11px;
    color: #ef4444;
    padding: 4px 8px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
  }

  .command-api-tag {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
  }

  .command-toggle-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
  }

  .command-toggle-option input {
    accent-color: #3b82f6;
    cursor: pointer;
  }

  .commands-empty {
    padding: 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    font-style: italic;
  }

  .command-row-builtin {
    opacity: 0.8;
  }

  .command-row-builtin:hover {
    opacity: 1;
  }

  .command-lock {
    color: rgba(255, 255, 255, 0.3);
    margin-left: auto;
  }

  .command-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .command-info .command-desc {
    flex: 1;
  }

  /* SOQL Mode Styles */
  .soql-suggestions {
    max-height: 240px;
    overflow-y: auto;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .soql-suggestions::-webkit-scrollbar {
    width: 10px;
  }

  .soql-suggestions::-webkit-scrollbar-track {
    background: transparent;
  }

  .soql-suggestions::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .soql-suggestions::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .soql-suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .soql-suggestion-item.selected {
    background: rgba(59, 130, 246, 0.15);
  }

  .soql-suggestion-type {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    min-width: 24px;
    text-align: center;
  }

  .soql-suggestion-type.type-keyword {
    background: rgba(147, 51, 234, 0.2);
    color: #a78bfa;
  }

  .soql-suggestion-type.type-object {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .soql-suggestion-type.type-field {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
  }

  .soql-suggestion-type.type-function {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .soql-suggestion-type.type-operator {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .soql-suggestion-value {
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'SF Mono', Monaco, monospace;
  }

  .soql-suggestion-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .soql-suggestion-detail {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    margin-left: auto;
    font-family: 'SF Mono', Monaco, monospace;
  }

  /* SOQL Error */
  .soql-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 16px 20px;
    background: rgba(239, 68, 68, 0.08);
    border-bottom: 1px solid rgba(239, 68, 68, 0.15);
  }

  .soql-error .error-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.2);
    border-radius: 50%;
    color: #f87171;
    font-size: 12px;
    font-weight: 700;
  }

  .soql-error .error-message {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.5;
    font-family: 'SF Mono', Monaco, monospace;
    word-break: break-word;
  }

  /* SOQL Results */
  .soql-results {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .soql-table-container {
    min-height: 0;
  }

  .soql-results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
  }

  .results-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
  }

  .export-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .export-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: #60a5fa;
  }

  .export-btn:active {
    transform: scale(0.95);
  }

  .export-success {
    font-size: 11px;
    color: #4ade80;
    font-weight: 500;
    animation: fade-in 0.2s ease;
  }

  /* SOQL Table */
  .soql-table-container {
    flex: 1;
    overflow: auto;
    padding: 0;
  }

  .soql-table-container::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .soql-table-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .soql-table-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .soql-table-container::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .soql-table-container::-webkit-scrollbar-corner {
    background: transparent;
  }

  .soql-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .soql-table th,
  .soql-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    white-space: nowrap;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .soql-table th {
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .soql-table td {
    color: rgba(255, 255, 255, 0.8);
    font-family: 'SF Mono', Monaco, monospace;
  }

  .soql-table tr:hover td {
    background: rgba(255, 255, 255, 0.03);
  }

  .soql-table tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.01);
  }

  .soql-table tr:nth-child(even):hover td {
    background: rgba(255, 255, 255, 0.04);
  }

  /* Subquery result display */
  .subquery-result {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 400px;
  }

  .subquery-count {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .subquery-records {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .subquery-record {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 3px;
    font-size: 11px;
  }

  .subquery-field {
    display: inline-flex;
    gap: 4px;
    white-space: nowrap;
  }

  .subquery-field-name {
    color: rgba(255, 255, 255, 0.5);
  }

  .subquery-more {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    padding: 2px 6px;
    font-style: italic;
  }

  .soql-table td .subquery-result {
    white-space: normal;
  }
`
