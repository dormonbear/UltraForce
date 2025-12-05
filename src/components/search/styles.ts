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
  }

  /* Search Input Section */
  .search-input-section {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
  }

  .search-icon {
    color: rgba(255, 255, 255, 0.4);
    margin-right: 16px;
    width: 20px;
    height: 20px;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none !important;
    color: #ffffff;
    font-size: 20px;
    font-weight: 400;
    outline: none !important;
    box-shadow: none !important;
    line-height: 1.4;
    letter-spacing: -0.01em;
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

  .object-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .result-item:hover .object-actions,
  .result-item.selected .object-actions {
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

  .setting-section {
    margin-bottom: 32px;
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
`
