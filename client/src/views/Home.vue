<template>
    <div class="chat" :class="{'chat--dark': $vuetify.theme.dark, 'chat--mobile': mobile, 'chat--desktop': !mobile, 'chat--reading': !!reader}">
        <!-- 电脑端：和微信网页版文件传输助手一样，是深色背景上居中的一个窗口，标题栏在窗口里 -->
        <div v-if="!mobile" class="chat-header">
            <span class="chat-title">传输助手<template v-if="$root.room">（{{$root.room}}）</template></span>
            <span v-if="$root.device.length > 1" class="chat-online">{{$root.device.length}} 台设备在线</span>
            <v-spacer></v-spacer>
            <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                    <v-btn v-on="on" icon small @click="if (!$root.websocket && !$root.websocketConnecting) {$root.retry = 0; $root.connect();}">
                        <span class="chat-status" :class="{'chat-status--on': $root.websocket, 'chat-status--pending': $root.websocketConnecting}"></span>
                    </v-btn>
                </template>
                <span>{{$root.websocket ? '已连接' : ($root.websocketConnecting ? '连接中' : '未连接，点击重连')}}</span>
            </v-tooltip>
            <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                    <v-btn v-on="on" icon small @click="$root.$emit('app:clear')"><v-icon small>{{mdiDeleteSweepOutline}}</v-icon></v-btn>
                </template>
                <span>清空聊天记录</span>
            </v-tooltip>
            <v-tooltip bottom>
                <template v-slot:activator="{ on }">
                    <v-btn v-on="on" icon small @click="$root.$emit('app:drawer')"><v-icon small>{{mdiDotsHorizontal}}</v-icon></v-btn>
                </template>
                <span>更多</span>
            </v-tooltip>
        </div>

        <!-- 消息列表 -->
        <div ref="list" class="chat-list" @scroll="onScroll">
            <div class="chat-inner">
                <div v-if="!items.length" class="chat-empty">在手机和电脑上打开这个页面，就可以互传文字和文件<br>{{mobile ? '点右下角的「+」发送图片和文件' : '文件直接拖进来即可发送'}}</div>
                <template v-for="item in items">
                    <div v-if="item.timeText" :key="`t${item.key}`" class="chat-time">{{item.timeText}}</div>
                    <chat-message
                        :key="item.key"
                        :meta="item.meta"
                        :self="item.self"
                        @menu="openMenu"
                        @preview="previewImage"
                        @read="readText"
                        @media-load="onMediaLoad"
                    ></chat-message>
                </template>
            </div>
        </div>

        <div v-if="unread" class="chat-unread" @click="scrollToBottom(true)">
            <v-icon small color="#07c160">{{mdiChevronDoubleDown}}</v-icon>
            {{unread}} 条新消息
        </div>

        <!-- 电脑端输入区：和微信电脑版一样，工具栏 + 大文本框 + 右下角发送 -->
        <div v-if="!mobile" class="chat-input">
            <div class="chat-input-inner">
                <div class="chat-toolbar">
                    <v-tooltip top>
                        <template v-slot:activator="{ on }">
                            <v-btn v-on="on" icon small @click="$refs.fileInput.click()">
                                <v-icon>{{mdiFolderOutline}}</v-icon>
                            </v-btn>
                        </template>
                        <span>发送文件（也可以直接拖进来或 Ctrl+V 粘贴）</span>
                    </v-tooltip>
                </div>
                <textarea
                    ref="textarea"
                    v-model="text"
                    class="chat-textarea"
                    name="chat-message"
                    autocomplete="off"
                    spellcheck="false"
                    :maxlength="$root.config.text.limit || null"
                    @keydown.enter="onEnter"
                ></textarea>
                <div class="chat-send-row">
                    <span class="chat-hint">Enter 发送，Shift + Enter 换行</span>
                    <button
                        class="chat-send"
                        :class="{'chat-send--active': canSendText}"
                        :disabled="!canSendText"
                        @click="sendText"
                    >发送(S)</button>
                </div>
            </div>
        </div>

        <!-- 手机端输入区：和微信手机版一样，输入框 + 「+」面板 -->
        <div v-else class="chat-input-mobile">
            <div class="chat-input-mobile-bar">
                <textarea
                    ref="textarea"
                    v-model="text"
                    rows="1"
                    class="chat-textarea-mobile"
                    name="chat-message"
                    autocomplete="off"
                    enterkeyhint="send"
                    :maxlength="$root.config.text.limit || null"
                    @keydown.enter="onEnter"
                    @input="autoGrow"
                    @focus="panel = false"
                ></textarea>
                <button v-if="text.trim()" class="chat-send chat-send--active" @click="sendText">发送</button>
                <v-btn v-else icon @click="togglePanel">
                    <v-icon large>{{panel ? mdiCloseCircleOutline : mdiPlusCircleOutline}}</v-icon>
                </v-btn>
            </div>
            <div v-if="panel" class="chat-panel">
                <div class="chat-panel-item" @click="$refs.albumInput.click()">
                    <div class="chat-panel-icon"><v-icon>{{mdiImageOutline}}</v-icon></div>
                    <div>相册</div>
                </div>
                <div class="chat-panel-item" @click="$refs.cameraInput.click()">
                    <div class="chat-panel-icon"><v-icon>{{mdiCameraOutline}}</v-icon></div>
                    <div>拍摄</div>
                </div>
                <div class="chat-panel-item" @click="$refs.fileInput.click()">
                    <div class="chat-panel-icon"><v-icon>{{mdiFolderOutline}}</v-icon></div>
                    <div>文件</div>
                </div>
            </div>
        </div>

        <input ref="fileInput" type="file" multiple class="d-none" @change="onPick">
        <input ref="albumInput" type="file" multiple accept="image/*,video/*" class="d-none" @change="onPick">
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="d-none" @change="onPick">

        <!-- 拖文件进来时的遮罩 -->
        <div v-if="dragging" class="chat-drop">
            <div class="chat-drop-text">松开即可发送</div>
        </div>

        <!-- 右键 / 长按菜单 -->
        <v-menu
            v-model="menu.show"
            :position-x="menu.x"
            :position-y="menu.y"
            absolute
            offset-y
            min-width="120"
        >
            <v-list dense>
                <v-list-item v-for="action in menuActions" :key="action.label" @click="action.run">
                    <v-list-item-title :class="{'error--text': action.danger}">{{action.label}}</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>

        <!-- 全屏看文字（双击或长按「选择文字」），这里可以用系统的选择框自由选择复制 -->
        <div v-if="reader" class="chat-reader" @click.self="reader = null">
            <div class="chat-reader-bar">
                <v-btn icon @click="reader = null"><v-icon>{{mdiClose}}</v-icon></v-btn>
                <v-spacer></v-spacer>
                <v-btn text color="primary" @click="copy(reader.text)">复制全部</v-btn>
            </div>
            <div class="chat-reader-text" v-html="reader.html" v-linkified></div>
        </div>

        <!-- 看大图 -->
        <v-overlay :value="!!viewer" opacity="0.92" z-index="20" @click.native="viewer = null">
            <img v-if="viewer" :src="viewer.url" :alt="viewer.name" class="chat-viewer-img">
            <div v-if="viewer" class="chat-viewer-actions" @click.stop>
                <v-btn text dark :href="viewer.url" :download="viewer.name">
                    <v-icon left>{{mdiDownload}}</v-icon>下载
                </v-btn>
                <v-btn text dark @click="viewer = null">
                    <v-icon left>{{mdiClose}}</v-icon>关闭
                </v-btn>
            </div>
        </v-overlay>
    </div>
</template>

<script>
import ChatMessage from '@/components/ChatMessage.vue';
import {
    prettyFileSize,
    formatChatTime,
    copyToClipboard,
    unescapeHtml,
    clearSelection,
} from '@/util.js';
import {
    uploadFile,
} from '@/upload.js';
import {
    mdiFolderOutline,
    mdiPlusCircleOutline,
    mdiCloseCircleOutline,
    mdiImageOutline,
    mdiCameraOutline,
    mdiChevronDoubleDown,
    mdiDownload,
    mdiClose,
    mdiDeleteSweepOutline,
    mdiDotsHorizontal,
} from '@mdi/js';

// 两条消息间隔超过 5 分钟才显示时间，和微信一样
const TIME_GAP = 300;

let uploadKey = 0;

const coarsePointer = matchMedia('(pointer: coarse)').matches;

export default {
    components: {
        ChatMessage,
    },
    data() {
        return {
            text: '',
            panel: false,
            dragging: false,
            dragDepth: 0,
            atBottom: true,
            unread: 0,
            newestId: null,
            uploads: [],
            uploadRunning: false,
            menu: {
                show: false,
                x: 0,
                y: 0,
                meta: null,
            },
            viewer: null,
            reader: null,
            mdiFolderOutline,
            mdiPlusCircleOutline,
            mdiCloseCircleOutline,
            mdiImageOutline,
            mdiCameraOutline,
            mdiChevronDoubleDown,
            mdiDownload,
            mdiClose,
            mdiDeleteSweepOutline,
            mdiDotsHorizontal,
        };
    },
    computed: {
        // 手机、平板等触屏设备，或者窗口很窄时用手机版输入区
        mobile() {
            return this.$vuetify.breakpoint.xsOnly || coarsePointer;
        },
        canSendText() {
            return !!this.text.trim() && !!this.$root.websocket;
        },
        items() {
            const result = [];
            let lastTime = null;
            // $root.received 是新的在前，聊天界面要旧的在前
            for (let i = this.$root.received.length - 1; i >= 0; i--) {
                const meta = this.$root.received[i];
                const time = this.messageTime(meta);
                let timeText = null;
                if (time && (lastTime === null || time - lastTime > TIME_GAP)) {
                    timeText = formatChatTime(time);
                }
                if (time) lastTime = time;
                result.push({
                    key: `m${meta.id}`,
                    meta,
                    self: !!meta.sender && meta.sender === this.$root.clientId,
                    timeText,
                });
            }
            this.uploads.forEach(e => result.push({
                key: `u${e.key}`,
                meta: e,
                self: true,
                timeText: null,
            }));
            return result;
        },
        menuActions() {
            const meta = this.menu.meta;
            if (!meta) return [];
            const actions = [];
            if (meta.type === 'uploading') {
                if (meta.status === 'error') actions.push({label: '重新发送', run: () => this.retryUpload(meta)});
                actions.push({label: '删除', danger: true, run: () => this.removeUpload(meta)});
                return actions;
            }
            if (meta.type === 'text') {
                actions.push({label: '复制', run: () => this.copy(unescapeHtml(meta.content))});
                actions.push({label: '选择文字', run: () => this.readText(meta)});
            }
            if (meta.type === 'file' && Date.now() / 1000 <= meta.expire) {
                const url = `file/${meta.cache}/${encodeURIComponent(meta.name)}`;
                if (meta.thumbnail) actions.push({label: '查看大图', run: () => this.previewImage(meta)});
                actions.push({label: '下载', run: () => this.download(url, meta.name)});
            }
            actions.push({label: '复制链接', run: () => this.copy(this.contentLink(meta))});
            actions.push({label: '删除', danger: true, run: () => this.deleteMessage(meta)});
            return actions;
        },
    },
    watch: {
        '$root.received'(received) {
            const newest = received[0];
            if (!newest || newest.id === this.newestId) return;
            const firstLoad = this.newestId === null;
            this.newestId = newest.id;
            // 刚打开、自己发的、或者本来就在底部，就跟着滚到底；否则提示有新消息
            if (firstLoad || this.atBottom || newest.sender === this.$root.clientId) {
                this.scrollToBottom();
            } else {
                this.unread++;
            }
        },
        mobile() {
            this.setPageClass(true);
        },
        'uploads.length'(newval, oldval) {
            if (newval > oldval) this.scrollToBottom();
        },
    },
    methods: {
        messageTime(meta) {
            if (meta.time) return meta.time;
            // 旧版本没有记录发送时间，文件可以从过期时间倒推
            if (meta.type === 'file' && meta.expire && this.$root.config.file.expire) {
                return meta.expire - this.$root.config.file.expire;
            }
            return null;
        },
        onScroll() {
            const list = this.$refs.list;
            this.atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            if (this.atBottom) this.unread = 0;
        },
        scrollToBottom(smooth = false) {
            this.$nextTick(() => {
                const list = this.$refs.list;
                if (!list) return;
                list.scrollTo({top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto'});
                this.atBottom = true;
                this.unread = 0;
            });
        },
        onMediaLoad() {
            // 图片加载出来后高度变了，原本在底部就继续保持在底部
            if (this.atBottom) this.scrollToBottom();
        },
        errorText(error, prefix) {
            return error.response && error.response.data && error.response.data.msg
                ? `${prefix}：${error.response.data.msg}`
                : prefix;
        },

        // ---------- 文本 ----------
        onEnter(e) {
            // Shift+Enter 换行；输入法正在选词时的回车也不发送
            if (e.shiftKey || e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            this.sendText();
        },
        autoGrow() {
            const el = this.$refs.textarea;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        },
        async sendText() {
            const text = this.text;
            if (!text.trim()) return;
            if (!this.$root.websocket) {
                this.$toast('还没有连接到服务器');
                return;
            }
            if (text.length > this.$root.config.text.limit) {
                this.$toast(`文本长度不能超过 ${this.$root.config.text.limit} 字`);
                return;
            }
            this.text = '';
            this.$nextTick(this.autoGrow);
            try {
                await this.$http.post('text', text, {
                    params: new URLSearchParams([['room', this.$root.room]]),
                    headers: {'Content-Type': 'text/plain'},
                });
            } catch (error) {
                // 发送失败就把文字放回输入框，免得丢
                if (!this.text) this.text = text;
                this.$toast(this.errorText(error, '发送失败'));
            }
        },

        // ---------- 文件 ----------
        onPick(e) {
            this.sendFiles(Array.from(e.target.files));
            e.target.value = '';
            this.panel = false;
        },
        /** @param {File[]} files */
        sendFiles(files) {
            files.forEach(file => {
                if (!file.size) {
                    this.$toast(`不能发送空文件或文件夹：${file.name}`);
                } else if (file.size > this.$root.config.file.limit) {
                    this.$toast(`${file.name} 超过大小限制（${prettyFileSize(this.$root.config.file.limit)}）`);
                } else {
                    this.uploads.push({
                        type: 'uploading',
                        key: ++uploadKey,
                        name: file.name || '粘贴的图片.png',
                        size: file.size,
                        loaded: 0,
                        status: 'waiting',
                        file,
                    });
                }
            });
            this.runUploads();
        },
        // 一个一个按顺序上传，保证消息顺序和拖进来的顺序一致
        async runUploads() {
            if (this.uploadRunning) return;
            this.uploadRunning = true;
            try {
                let item;
                while ((item = this.uploads.find(e => e.status === 'waiting'))) {
                    item.status = 'uploading';
                    try {
                        await uploadFile(item.file, {
                            room: this.$root.room,
                            chunkSize: this.$root.config.file.chunk,
                            onProgress: loaded => item.loaded = loaded,
                        });
                        this.uploads.splice(this.uploads.indexOf(item), 1);
                    } catch (error) {
                        item.status = 'error';
                        this.$toast(this.errorText(error, `${item.name} 发送失败`));
                    }
                }
            } finally {
                this.uploadRunning = false;
            }
        },
        retryUpload(item) {
            item.status = 'waiting';
            item.loaded = 0;
            this.runUploads();
        },
        removeUpload(item) {
            const index = this.uploads.indexOf(item);
            if (index !== -1) this.uploads.splice(index, 1);
        },
        togglePanel() {
            this.panel = !this.panel;
            if (this.panel) this.scrollToBottom();
        },

        // ---------- 拖拽和粘贴 ----------
        hasFiles(e) {
            return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
        },
        onDragEnter(e) {
            if (!this.hasFiles(e)) return;
            e.preventDefault();
            this.dragDepth++;
            this.dragging = true;
        },
        onDragOver(e) {
            if (!this.hasFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        },
        onDragLeave(e) {
            if (!this.hasFiles(e)) return;
            this.dragDepth = Math.max(0, this.dragDepth - 1);
            if (!this.dragDepth) this.dragging = false;
        },
        onDrop(e) {
            if (!this.hasFiles(e)) return;
            e.preventDefault();
            this.dragDepth = 0;
            this.dragging = false;
            const items = Array.from(e.dataTransfer.items || []);
            const files = [];
            Array.from(e.dataTransfer.files).forEach((file, i) => {
                const entry = items[i] && items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
                if (entry && entry.isDirectory) {
                    this.$toast(`暂不支持发送文件夹：${file.name}`);
                } else {
                    files.push(file);
                }
            });
            this.sendFiles(files);
        },
        // 拖拽过程中不会触发 mousemove，能收到就说明拖拽已经结束，防止遮罩卡住
        resetDrag() {
            if (!this.dragging) return;
            this.dragDepth = 0;
            this.dragging = false;
        },
        onPaste(e) {
            if (!e.clipboardData) return;
            const items = Array.from(e.clipboardData.items);
            // 同时带文字的（比如从 Excel 复制）当作文字粘贴
            if (!items.some(e => e.kind === 'file') || items.some(e => e.type === 'text/plain')) return;
            e.preventDefault();
            this.sendFiles(items.filter(e => e.kind === 'file').map(e => e.getAsFile()));
        },

        // ---------- 菜单里的操作 ----------
        openMenu({x, y, meta}) {
            this.menu.show = false;
            this.$nextTick(() => {
                Object.assign(this.menu, {x, y, meta, show: true});
            });
        },
        contentLink(meta) {
            const url = new URL(`content/${meta.id}`, location.href);
            if (this.$root.room) url.searchParams.set('room', this.$root.room);
            return url.href;
        },
        copy(text) {
            copyToClipboard(text)
                .then(() => this.$toast('已复制'))
                .catch(error => this.$toast.error(`复制失败：${error.message || error}`));
        },
        download(url, name) {
            const a = document.createElement('a');
            // 带上 download=1 让服务器按附件发，iPhone 上才会下载而不是直接打开播放
            a.href = url + '?download=1';
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },
        readText(meta) {
            clearSelection();
            this.reader = {
                html: meta.content.replace(/\n/g, '<br>'),
                text: unescapeHtml(meta.content),
            };
        },
        previewImage(meta) {
            this.viewer = {
                url: `file/${meta.cache}/${encodeURIComponent(meta.name)}`,
                name: meta.name,
            };
        },
        async deleteMessage(meta) {
            try {
                await this.$http.delete(`revoke/${meta.id}`, {
                    params: new URLSearchParams([['room', this.$root.room]]),
                });
                if (meta.type === 'file' && Date.now() / 1000 <= meta.expire) {
                    await this.$http.delete(`file/${meta.cache}`);
                }
            } catch (error) {
                this.$toast(this.errorText(error, '删除失败'));
            }
        },
        onKeydown(e) {
            if (e.key === 'Escape' && this.viewer) this.viewer = null;
            if (e.key === 'Escape' && this.reader) this.reader = null;
            // 电脑端在页面任意位置打字时，自动聚焦到输入框
            if (!this.mobile && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const active = document.activeElement;
                if (!active || !['INPUT', 'TEXTAREA'].includes(active.tagName)) {
                    this.$refs.textarea && this.$refs.textarea.focus();
                }
            }
        },
        setPageClass(active) {
            const cl = document.documentElement.classList;
            cl.toggle('chat-page', active);
            cl.toggle('chat-desktop', active && !this.mobile);
        },
        bindWindowEvents(bind) {
            const method = bind ? 'addEventListener' : 'removeEventListener';
            window[method]('dragenter', this.onDragEnter);
            window[method]('dragover', this.onDragOver);
            window[method]('dragleave', this.onDragLeave);
            window[method]('drop', this.onDrop);
            window[method]('mousemove', this.resetDrag);
            document[method]('paste', this.onPaste);
            document[method]('keydown', this.onKeydown);
        },
    },
    activated() {
        this.bindWindowEvents(true);
        this.setPageClass(true);
        this.scrollToBottom();
    },
    deactivated() {
        this.bindWindowEvents(false);
        this.setPageClass(false);
    },
    beforeRouteEnter(to, from, next) {
        next(vm => vm.$root.room = to.query.room || '');
    },
    beforeRouteUpdate(to, from, next) {
        this.$root.room = to.query.room || '';
        next();
    },
};
</script>

<style>
/* 聊天页面自己滚动，整页不要出滚动条 */
html.chat-page {
    overflow: hidden !important;
}
/* 电脑端：深色背景，隐藏原来的顶栏，标题栏放进聊天窗口里 */
html.chat-desktop #app {
    background: #2e2e2e !important;
}
html.chat-desktop #app.theme--dark {
    background: #191919 !important;
}
html.chat-desktop .app-header {
    display: none !important;
}
</style>

<style scoped>
.chat {
    --chat-bg: #f5f5f5;
    --bubble-self: #95ec69;
    --bubble-self-text: #191919;
    --bubble-other: #ffffff;
    --bubble-other-text: #191919;
    --text-secondary: #888;
    --divider: rgba(0, 0, 0, .08);
    --input-bg: #ffffff;
    --panel-bg: #f7f7f7;

    position: fixed;
    top: 48px;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: var(--chat-bg);
    /* 低于侧边菜单和弹窗 */
    z-index: 1;
}
.chat--desktop {
    --w: min(760px, calc(100vw - 48px));
    --h: min(880px, calc(100vh - 48px));
    top: calc((100vh - var(--h)) / 2);
    left: calc((100vw - var(--w)) / 2);
    right: auto;
    bottom: auto;
    width: var(--w);
    height: var(--h);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 6px 30px rgba(0, 0, 0, .35);
}
.chat-header {
    flex: none;
    height: 56px;
    padding: 0 12px 0 22px;
    display: flex;
    align-items: center;
    gap: 2px;
    border-bottom: 1px solid var(--divider);
    background: var(--chat-bg);
}
.chat-title {
    font-size: 16px;
    color: var(--bubble-other-text);
}
.chat-online {
    margin-left: 8px;
    font-size: 12px;
    color: var(--text-secondary);
}
.chat-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fa5151;
}
.chat-status--pending {
    background: #f2a93b;
}
.chat-status--on {
    background: #07c160;
}
.chat--dark {
    --chat-bg: #111111;
    --bubble-self: #3eb575;
    --bubble-self-text: #0f0f0f;
    --bubble-other: #2c2c2c;
    --bubble-other-text: #d5d5d5;
    --text-secondary: #8c8c8c;
    --divider: rgba(255, 255, 255, .08);
    --input-bg: #1e1e1e;
    --panel-bg: #1e1e1e;
}

.chat-list {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.chat-inner {
    padding: 20px 28px 4px;
}
.chat--mobile {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
.chat--mobile .chat-inner {
    padding: 12px 10px 4px;
}
.chat-empty {
    margin-top: 28vh;
    line-height: 2;
    text-align: center;
    font-size: 13px;
    color: var(--text-secondary);
}
.chat-time {
    margin: 4px 0 16px;
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
}

.chat-unread {
    position: absolute;
    right: 24px;
    bottom: 166px;
    line-height: 1.4;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--bubble-other);
    color: #07c160;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .12);
    cursor: pointer;
    z-index: 2;
}
.chat--mobile .chat-unread {
    bottom: 80px;
    right: 12px;
}

/* 电脑端输入区 */
.chat-input {
    flex: none;
    height: 150px;
    border-top: 1px solid var(--divider);
    background: var(--input-bg);
}
.chat-input-inner {
    height: 100%;
    padding: 6px 28px 12px;
    display: flex;
    flex-direction: column;
}
.chat-toolbar {
    flex: none;
    display: flex;
    gap: 4px;
}
.chat-textarea {
    flex: 1;
    width: 100%;
    margin-top: 4px;
    resize: none;
    outline: none;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 14px;
    line-height: 1.6;
}
.chat-send-row {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
}
.chat-hint {
    font-size: 12px;
    color: var(--text-secondary);
}
.chat-send {
    padding: 5px 22px;
    border-radius: 4px;
    font-size: 14px;
    background: var(--divider);
    color: var(--text-secondary);
    cursor: default;
}
.chat-send--active {
    background: #07c160;
    color: #fff;
    cursor: pointer;
}
.chat-send--active:hover {
    background: #06ad56;
}

/* 手机端输入区 */
.chat-input-mobile {
    flex: none;
    background: var(--panel-bg);
    border-top: 1px solid var(--divider);
    padding-bottom: env(safe-area-inset-bottom);
}
.chat-input-mobile-bar {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 10px;
}
.chat-textarea-mobile {
    -webkit-user-select: text;
    user-select: text;
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    padding: 9px 10px;
    border-radius: 4px;
    resize: none;
    outline: none;
    border: none;
    background: var(--bubble-other);
    color: inherit;
    font-size: 16px;
    line-height: 22px;
}
.chat-input-mobile-bar .chat-send {
    height: 40px;
    padding: 0 14px;
}
.chat-panel {
    display: flex;
    gap: 28px;
    padding: 16px 24px 24px;
    border-top: 1px solid var(--divider);
}
.chat-panel-item {
    text-align: center;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
}
.chat-panel-icon {
    width: 60px;
    height: 60px;
    margin-bottom: 6px;
    border-radius: 12px;
    background: var(--bubble-other);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 拖拽遮罩 */
.chat-drop {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, .45);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.chat-drop-text {
    color: #fff;
    font-size: 18px;
    letter-spacing: 1px;
}

/* 全屏看文字 */
.chat-reader {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: #fff;
}
.chat--reading {
    /* .chat 自己是一个层叠上下文，全屏看文字时要整体抬到顶栏上面 */
    z-index: 30 !important;
}
.chat--dark .chat-reader {
    background: #191919;
}
.chat-reader-bar {
    flex: none;
    display: flex;
    align-items: center;
    padding: 4px 8px;
    padding-top: calc(4px + env(safe-area-inset-top));
}
.chat-reader-text {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px calc(32px + env(safe-area-inset-bottom));
    font-size: 20px;
    line-height: 1.7;
    word-break: break-word;
    -webkit-user-select: text !important;
    user-select: text !important;
    -webkit-touch-callout: default;
}
.chat-reader-text >>> a {
    color: #576b95;
    text-decoration: none;
}

/* 看大图 */
.chat-viewer-img {
    display: block;
    max-width: 96vw;
    max-height: 84vh;
    object-fit: contain;
}
.chat-viewer-actions {
    margin-top: 12px;
    text-align: center;
}
</style>
