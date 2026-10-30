export function prettyFileSize(size) {
    let units = ['TB', 'GB', 'MB', 'KB'];
    let unit = 'Bytes';
    while (size >= 1024 && units.length) {
        size /= 1024;
        unit = units.pop();
    };
    return `${Math.floor(100 * size) / 100} ${unit}`;
}

export function percentage(value, decimal = 2) {
    return (value * 100).toFixed(decimal) + '%';
}

export function formatTimestamp(timestamp) {
    let date = new Date(timestamp * 1000);
    return ''
        + date.getFullYear() + '-'
        + (date.getMonth() + 1).toString().padStart(2, 0) + '-'
        + date.getDate().toString().padStart(2, 0) + ' '
        + date.getHours().toString().padStart(2, 0) + ':'
        + date.getMinutes().toString().padStart(2, 0) + ':'
        + date.getSeconds().toString().padStart(2, 0);
};

// 每个浏览器一个固定的设备 ID，用来区分「本机发的」和「其他设备发的」
// 局域网 http 下不是安全上下文，没有 crypto.randomUUID，所以用 getRandomValues
export const clientId = (() => {
    let id = '';
    try {
        id = localStorage.getItem('clientId') || '';
    } catch {}
    if (!/^[0-9a-f]{32}$/.test(id)) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(16)), e => e.toString(16).padStart(2, '0')).join('');
        try {
            localStorage.setItem('clientId', id);
        } catch {}
    }
    return id;
})();

// 微信式的时间：今天只显示时分，昨天加「昨天」，今年显示月日，更早显示年月日
export function formatChatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const now = new Date;
    const hm = date.getHours().toString().padStart(2, 0) + ':' + date.getMinutes().toString().padStart(2, 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (date.getTime() >= startOfToday) return hm;
    if (date.getTime() >= startOfToday - 86400000) return `昨天 ${hm}`;
    if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
}

export function clearSelection() {
    const selection = window.getSelection && window.getSelection();
    if (selection) selection.removeAllRanges();
}

// 局域网 http 下 navigator.clipboard 不可用，退回到 execCommand
export function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        // 16px 以上 iOS 才不会因为聚焦而放大页面
        textarea.style.fontSize = '16px';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        textarea.blur();
        document.body.removeChild(textarea);
        // 复制完清掉选区，否则手机上会残留整页被选中的状态
        clearSelection();
        ok ? resolve() : reject(new Error('浏览器不允许复制'));
    });
}

// 消息正文是服务端转义过的 HTML，复制时还原成纯文本
export function unescapeHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html').documentElement.textContent;
}