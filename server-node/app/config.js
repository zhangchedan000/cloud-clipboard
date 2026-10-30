import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const defaultConfigPath = path.join(process.cwd(), 'config.json');
const configPath = process.argv[2] || defaultConfigPath;

// 指定的配置文件不存在时也自动生成，Docker 里挂载一个空目录就能直接用；
// 通过参数指定配置文件时，聊天记录和上传的文件也放在配置文件所在的目录，方便持久化
if (!fs.existsSync(configPath)) {
    const dataDir = process.argv[2] ? path.dirname(configPath) : null;
    console.log(`\x1b[93mConfig file "${configPath}" does not exist.\x1b[39m`);
    console.log('\x1b[93mA default config file is created and used. Check the descriptions in the repository\'s README.md to modify it.\x1b[39m');
    fs.mkdirSync(path.dirname(configPath), {recursive: true});
    fs.writeFileSync(configPath, JSON.stringify({
        server: {
            host: [],
            port: 9501,
            uds: null,
            prefix: '',
            key: null,
            cert: null,
            history: 1000,
            auth: false,
            historyFile: dataDir && path.join(dataDir, 'history.json'),
            storageDir: dataDir && path.join(dataDir, 'storage'),
        },
        text: {
            limit: 100000,
        },
        file: {
            expire: 604800,
            chunk: 2097152,
            limit: 0,
        },
    }, null, 4));
}

/**
 * @type {{
 *  server: {
 *      host: String | String[],
 *      port: [Number],
 *      uds: [String],
 *      prefix: [String],
 *      key: [String],
 *      cert: [String],
 *      forceWss: [Boolean],
 *      history: Number,
 *      auth: Boolean,
 *      historyFile: [String],
 *      storageDir: [String],
 *  },
 *  text: {
 *      limit: Number,
 *  },
 *  file: {
 *      expire: Number,
 *      chunk: Number,
 *      limit: Number,
 *  },
 * }}
 */
const config = JSON.parse(fs.readFileSync(configPath));

if (!config.server.prefix) {
    config.server.prefix = '';
}
if (config.server.auth === true) {
    config.server.auth = '';
    for (let i = 0; i < 6; i++) {
        config.server.auth += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[crypto.randomInt(62)];
    }
}
if (config.server.auth) {
    config.server.auth = config.server.auth.toString();
}
// file.limit 填 0（或不填）表示不限制文件大小
if (!(config.file.limit > 0)) {
    config.file.limit = Number.MAX_SAFE_INTEGER;
}

export default config;
