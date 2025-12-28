/**
 * Bookmarklet UI Utilities
 *
 * Helper functions for creating browser overlays and providing user feedback
 * These functions are inlined into the bookmarklet code
 */

export type OverlayType = 'loading' | 'success' | 'error';

const OVERLAY_ID = 'quebec-company-bookmarklet-overlay';

/**
 * Creates a styled overlay element for feedback
 */
export function createOverlay(message: string, type: OverlayType, companyId?: string): HTMLElement {
  // Remove any existing overlay
  removeOverlay();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  // Base styles
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    transition: opacity 0.3s ease;
    cursor: pointer;
  `;

  // Type-specific styles and icons
  switch (type) {
    case 'loading':
      overlay.style.backgroundColor = '#1f2937';
      overlay.style.color = '#f3f4f6';
      overlay.style.border = '2px solid #374151';
      overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 20px;
            height: 20px;
            border: 2px solid #f3f4f6;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <span>${message}</span>
        </div>
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      `;
      break;

    case 'success':
      overlay.style.backgroundColor = '#065f46';
      overlay.style.color = '#d1fae5';
      overlay.style.border = '2px solid = '#10b981';
      overlay.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="#d1fae5"/>
            </svg>
            <span style="font-weight: 600;">${message}</span>
          </div>
          ${companyId ? `
            <a
              href="${window.location.origin}/companies/${companyId}"
              target="_blank"
              style="
                color: #a7f3d0;
                text-decoration: underline;
                font-size: 13px;
                margin-left: 32px;
              "
            >
              View company →
            </a>
          ` : ''}
        </div>
      `;
      // Auto-dismiss after 5 seconds
      setTimeout(removeOverlay, 5000);
      break;

    case 'error':
      overlay.style.backgroundColor = '#7f1d1d';
      overlay.style.color = '#fecaca';
      overlay.style.border = '2px solid #dc2626';
      overlay.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; margin-top: 2px;">
            <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="#fecaca"/>
          </svg>
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">Error</div>
            <div style="font-size: 13px;">${message}</div>
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">Click to dismiss</div>
          </div>
        </div>
      `;
      break;
  }

  // Click to dismiss
  overlay.addEventListener('click', removeOverlay);

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Updates the message in an existing overlay
 */
export function updateOverlay(message: string): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    const messageElement = overlay.querySelector('span');
    if (messageElement) {
      messageElement.textContent = message;
    }
  }
}

/**
 * Removes the overlay from the DOM
 */
export function removeOverlay(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
}
