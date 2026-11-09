import axios from 'axios';

/**
 * 上传一个文件，小文件直接表单上传，大文件分片上传
 * @param {File} file
 * @param {{room: String, chunkSize: Number, onProgress: (loaded: Number) => void}} options
 */
export async function uploadFile(file, {room, chunkSize, onProgress}) {
    const params = new URLSearchParams([['room', room]]);
    if (file.size < chunkSize) {
        const fd = new FormData;
        fd.set('file', file);
        await axios.postForm('upload', fd, {
            params,
            onUploadProgress: e => onProgress(e.loaded),
        });
        return;
    }
    const response = await axios.post('upload/chunk', file.name, {headers: {'Content-Type': 'text/plain'}});
    const uuid = response.data.result.uuid;
    let uploadedSize = 0;
    while (uploadedSize < file.size) {
        // 先把这一段读进内存再发：iPhone 上直接发 Blob 切片，从第二段开始会卡住不动（相册里的视频尤其明显）
        const chunk = await file.slice(uploadedSize, uploadedSize + chunkSize).arrayBuffer();
        for (let attempt = 1; ; attempt++) {
            try {
                await axios.post(`upload/chunk/${uuid}`, chunk, {
                    headers: {'Content-Type': 'application/octet-stream'},
                    timeout: 60000,
                    onUploadProgress: e => onProgress(uploadedSize + e.loaded),
                });
                break;
            } catch (error) {
                // 超时或断网重试，服务器明确拒绝（4xx）就不重试了
                if (attempt >= 3 || error.response) throw error;
            }
        }
        uploadedSize += chunk.byteLength;
    }
    await axios.post(`upload/finish/${uuid}`, null, {params});
}
