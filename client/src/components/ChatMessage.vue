<template>
    <div class="msg" :class="{'msg--self': self}">
        <!-- 头像：手机显示手机、电脑显示电脑，每台设备一个颜色 -->
        <div v-if="meta.sender" class="msg-avatar" :style="{background: avatarColor}" :title="meta.deviceName">
            <v-icon dark>{{deviceIcon}}</v-icon>
        </div>
        <!-- 旧版本发的消息不知道是哪台设备，用「传输助手」的绿色文件夹头像 -->
        <svg v-else class="msg-avatar" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="10" fill="#07c160"/>
            <path fill="#fff" d="M12 19a3 3 0 0 1 3-3h11.2a3 3 0 0 1 2.3 1.1l2.6 3.1H49a3 3 0 0 1 3 3V45a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z"/>
            <path fill="#07c160" d="M24 32.5h11.5v-5.2L45 34.5l-9.5 7.2v-5.2H24z"/>
        </svg>
        <div
            class="msg-body"
            @contextmenu.prevent="openMenu($event.clientX, $event.clientY)"
            @touchstart.passive="touchStart"
            @touchmove.passive="touchCancel"
            @touchend="touchEnd"
            @touchcancel="touchCancel"
        >
            <!-- 文本 -->
            <div v-if="meta.type === 'text'" class="bubble bubble--text">
                <div
                    class="bubble-text"
                    :class="{'bubble-text--collapsed': isLong && !expanded}"
                    v-html="meta.content.replace(/\n/g, '<br>')"
                    v-linkified
                ></div>
                <a v-if="isLong" class="bubble-expand" @click="expanded = !expanded">{{expanded ? '收起' : '展开全文'}}</a>
            </div>

            <!-- 图片 -->
            <div
                v-else-if="meta.type === 'file' && isImage && !expired"
                class="bubble-media"
                @click="$emit('preview', meta)"
            >
                <img
                    :src="imageError ? meta.thumbnail : fileUrl"
                    :style="meta.thumbnail ? {backgroundImage: `url(${meta.thumbnail})`} : null"
                    :alt="meta.name"
                    @load="$emit('media-load')"
                    @error="imageError = true"
                >
            </div>

            <!-- 视频 -->
            <div v-else-if="meta.type === 'file' && isVideo && !expired" class="bubble-media">
                <video :src="fileUrl" controls preload="metadata" @loadedmetadata="$emit('media-load')"></video>
            </div>

            <!-- 其他文件，以及上传中的文件 -->
            <a
                v-else
                class="bubble bubble--file"
                :class="{'bubble--expired': expired}"
                :href="downloadable ? fileUrl : null"
                :download="downloadable ? meta.name : null"
            >
                <div class="file-info">
                    <div class="file-name" :title="meta.name">{{meta.name}}</div>
                    <div class="file-size">
                        <template v-if="meta.type === 'uploading'">
                            <template v-if="meta.status === 'error'">{{meta.size | prettyFileSize}}</template>
                            <template v-else-if="meta.status === 'waiting'">等待发送 · {{meta.size | prettyFileSize}}</template>
                            <template v-else>{{Math.min(meta.loaded, meta.size) | prettyFileSize}} / {{meta.size | prettyFileSize}}</template>
                        </template>
                        <template v-else>{{meta.size | prettyFileSize}}</template>
                    </div>
                </div>
                <div class="file-icon" :style="{background: fileColor}">{{fileExt || '?'}}</div>
                <div class="file-footer">
                    <template v-if="meta.type === 'uploading'">
                        <v-progress-linear
                            v-if="meta.status === 'uploading'"
                            :value="meta.size ? meta.loaded / meta.size * 100 : 0"
                            color="#07c160"
                            height="3"
                            rounded
                        ></v-progress-linear>
                        <span v-else-if="meta.status === 'error'" class="error--text">发送失败，右键或长按可重试</span>
                    </template>
                    <template v-else>{{expired ? '已过期' : `${expireText}过期`}}</template>
                </div>
            </a>

            <div v-if="meta.type === 'uploading' && meta.status === 'error'" class="msg-error" title="发送失败">!</div>
        </div>
    </div>
</template>

<script>
import {
    mdiCellphone,
    mdiTablet,
    mdiMonitor,
} from '@mdi/js';

const AVATAR_COLORS = ['#3e8bf7', '#f78a3e', '#a66df2', '#e8618c', '#33b26b', '#4bb3b8', '#f2a93b', '#5f7fa3', '#d9534f', '#8e6fd8'];
const EXT_COLORS = [
    [/^(zip|rar|7z|tar|gz|bz2|xz|tgz)$/, '#a66df2'],
    [/^(pdf)$/, '#f25b5b'],
    [/^(doc|docx|wps|rtf)$/, '#3e8bf7'],
    [/^(xls|xlsx|csv|et)$/, '#33b26b'],
    [/^(ppt|pptx|dps)$/, '#f78a3e'],
    [/^(exe|msi|apk|dmg|ipa|deb|rpm)$/, '#5f7fa3'],
    [/^(mp3|wav|flac|ogg|opus|m4a|aac)$/, '#f2a93b'],
    [/^(mp4|mkv|mov|avi|webm|flv|wmv|ogv)$/, '#e8618c'],
    [/^(ttf|otf|woff|woff2|ttc)$/, '#4bb3b8'],
    [/^(txt|md|log|json|xml|yml|yaml|ini|js|ts|py|sh|ps1|bat|html|css)$/, '#8a96a3'],
];

export default {
    name: 'chat-message',
    props: {
        meta: {
            type: Object,
            required: true,
        },
        self: Boolean,
    },
    data() {
        return {
            expanded: false,
            imageError: false,
            touchTimer: null,
            touchPoint: null,
        };
    },
    computed: {
        fileUrl() {
            return `file/${this.meta.cache}/${encodeURIComponent(this.meta.name)}`;
        },
        fileExt() {
            const m = (this.meta.name || '').match(/\.([0-9a-z]{1,5})$/i);
            return m ? m[1].toUpperCase() : '';
        },
        fileColor() {
            const ext = this.fileExt.toLowerCase();
            const found = EXT_COLORS.find(e => e[0].test(ext));
            return found ? found[1] : '#9aa5b1';
        },
        isImage() {
            return !!this.meta.thumbnail || /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i.test(this.meta.name);
        },
        isVideo() {
            return /\.(mp4|webm|ogv)$/i.test(this.meta.name);
        },
        expired() {
            return this.meta.type === 'file' && this.$root.date.getTime() / 1000 > this.meta.expire;
        },
        downloadable() {
            return this.meta.type === 'file' && !this.expired;
        },
        expireText() {
            const d = new Date(this.meta.expire * 1000);
            const hm = d.getHours().toString().padStart(2, 0) + ':' + d.getMinutes().toString().padStart(2, 0);
            return `将于 ${d.getMonth() + 1}月${d.getDate()}日 ${hm} `;
        },
        deviceIcon() {
            return {mobile: mdiCellphone, tablet: mdiTablet}[this.meta.deviceType] || mdiMonitor;
        },
        avatarColor() {
            let hash = 0;
            for (const c of this.meta.sender) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
            return AVATAR_COLORS[hash % AVATAR_COLORS.length];
        },
        isLong() {
            const content = this.meta.content || '';
            return content.length > 1200 || content.split('\n').length > 16;
        },
    },
    methods: {
        openMenu(x, y) {
            this.$emit('menu', {x, y, meta: this.meta});
        },
        // 手机上长按弹出菜单
        touchStart(e) {
            const t = e.touches[0];
            this.touchPoint = {x: t.clientX, y: t.clientY};
            clearTimeout(this.touchTimer);
            this.touchTimer = setTimeout(() => {
                this.touchTimer = null;
                if (navigator.vibrate) navigator.vibrate(10);
                this.openMenu(this.touchPoint.x, this.touchPoint.y);
            }, 500);
        },
        touchCancel() {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        },
        touchEnd(e) {
            // 长按已经弹出菜单时，不要再触发点击（比如下载）
            if (!this.touchTimer && this.touchPoint) e.preventDefault();
            this.touchCancel();
            this.touchPoint = null;
        },
    },
};
</script>

<style scoped>
.msg {
    display: flex;
    align-items: flex-start;
    margin: 0 0 16px;
}
.msg--self {
    flex-direction: row-reverse;
}
.msg-avatar {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.msg-body {
    position: relative;
    display: flex;
    max-width: min(70%, 520px);
    margin: 0 10px;
    -webkit-touch-callout: none;
}
.msg--self .msg-body {
    flex-direction: row-reverse;
}

.bubble--text {
    position: relative;
    padding: 9px 12px;
    border-radius: 4px;
    background: var(--bubble-other);
    color: var(--bubble-other-text);
    font-size: 14px;
    line-height: 1.6;
    min-width: 0;
}
.msg--self .bubble--text {
    background: var(--bubble-self);
    color: var(--bubble-self-text);
}
/* 气泡的小三角 */
.bubble--text::before {
    content: '';
    position: absolute;
    top: 12px;
    left: -6px;
    border: 6px solid transparent;
    border-left: 0;
    border-right-color: var(--bubble-other);
}
.msg--self .bubble--text::before {
    left: auto;
    right: -6px;
    border-right: 0;
    border-left: 6px solid var(--bubble-self);
}
.bubble-text {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    user-select: text;
}
.bubble-text--collapsed {
    max-height: 25.6em;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(#000 80%, transparent);
    mask-image: linear-gradient(#000 80%, transparent);
}
.bubble-text >>> a {
    color: #576b95;
    text-decoration: none;
}
.bubble-text >>> a:hover {
    text-decoration: underline;
}
.msg--self .bubble-text >>> a {
    color: #2a5a8a;
}
.bubble-expand {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: #576b95 !important;
}

.bubble-media {
    cursor: pointer;
    line-height: 0;
}
.bubble-media img,
.bubble-media video {
    max-width: min(240px, 100%);
    max-height: 240px;
    min-width: 60px;
    min-height: 40px;
    border-radius: 4px;
    background: var(--bubble-other) center / cover no-repeat;
    object-fit: contain;
}
.bubble-media video {
    max-width: min(320px, 100%);
    cursor: auto;
}

.bubble--file {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 12px;
    width: 240px;
    max-width: 100%;
    padding: 12px 12px 0;
    border-radius: 4px;
    background: var(--bubble-other);
    color: var(--bubble-other-text) !important;
    text-decoration: none;
    cursor: pointer;
}
.bubble--expired {
    cursor: default;
    opacity: .6;
}
.file-info {
    min-width: 0;
}
.file-name {
    font-size: 14px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-all;
}
.bubble--expired .file-name {
    text-decoration: line-through;
}
.file-size {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-secondary);
}
.file-icon {
    width: 40px;
    height: 46px;
    border-radius: 3px;
    color: #fff;
    font-size: 10px;
    font-weight: bold;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 6px;
    overflow: hidden;
}
.file-footer {
    grid-column: 1 / 3;
    margin-top: 10px;
    padding: 5px 0 6px;
    border-top: 1px solid var(--divider);
    font-size: 11px;
    color: var(--text-secondary);
    min-height: 27px;
    display: flex;
    align-items: center;
}

.msg-error {
    align-self: center;
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0 8px;
    border-radius: 50%;
    background: #fa5151;
    color: #fff;
    font-size: 12px;
    font-weight: bold;
    line-height: 18px;
    text-align: center;
}
</style>
