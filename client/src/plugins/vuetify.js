import Vue from 'vue';
import Vuetify, { VSnackbar, VBtn, VIcon } from 'vuetify/lib';
import VuetifyToast from 'vuetify-toast-snackbar';

const vuetify = new Vuetify({
    icons: {
        iconfont: 'mdiSvg',
    },
});


Vue.use(Vuetify, {
    components: {
        VSnackbar,
        VBtn,
        VIcon,
    }
});
Vue.use(VuetifyToast, {
    $vuetify: vuetify.framework,
    x: '',
    // 提示放在顶部，不挡住底部的输入框
    y: 'top',
    color: '',
    closeText: '关闭',
    closeColor: 'accent',
});

export default vuetify;