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
        const chunk = file.slice(uploadedSize, uploadedSize + chunkSize);
        await axios.post(`upload/chunk/${uuid}`, chunk, {
            headers: {'Content-Type': 'application/octet-stream'},
            onUploadProgress: e => onProgress(uploadedSize + e.loaded),
        });
        uploadedSize += chunk.size;
    }
    await axios.post(`upload/finish/${uuid}`, null, {params});
}
