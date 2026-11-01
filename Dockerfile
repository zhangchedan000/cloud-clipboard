# 前端构建产物与平台无关，在构建机本身的平台上编译，多架构构建时不用走 QEMU
FROM --platform=$BUILDPLATFORM node:22.12-alpine3.21 AS builder
ENV NODE_OPTIONS=--openssl-legacy-provider
COPY . /app
WORKDIR /app/client
RUN npm install
RUN npm run build

# 运行时用 Node 18：部分刷机软路由（如 QSDK 5.4 内核）上 Node 22 一启动就崩（Check failed: 0 == ret）
FROM node:18-alpine
ENV NODE_OPTIONS=--openssl-legacy-provider
COPY . /app
COPY --from=builder /app/client/dist/ /app/server-node/static/
WORKDIR /app/server-node
RUN npm install
EXPOSE 9501
# 配置、聊天记录、上传的文件都放在 /app/data，挂载这个目录即可持久化（首次启动自动生成配置）
VOLUME /app/data
CMD ["node", "main.js", "/app/data/config.json"]

