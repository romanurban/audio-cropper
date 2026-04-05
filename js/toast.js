/**
 * Toast notification system
 */

const TOAST_DURATION = 4000;
const TOAST_ICONS = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
};

let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

export function toast(message, level = 'info', duration = TOAST_DURATION) {
    const el = document.createElement('div');
    el.className = `toast toast-${level}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[level] || TOAST_ICONS.info}</span><span class="toast-message">${escapeHtml(message)}</span>`;

    getContainer().appendChild(el);

    // Trigger enter animation
    requestAnimationFrame(() => el.classList.add('toast-visible'));

    const dismiss = () => {
        el.classList.remove('toast-visible');
        el.addEventListener('transitionend', () => el.remove());
    };

    const timer = setTimeout(dismiss, duration);
    el.addEventListener('click', () => {
        clearTimeout(timer);
        dismiss();
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
