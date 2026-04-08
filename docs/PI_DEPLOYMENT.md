# 树莓派日常部署

这份文档只保留日常发布需要的最小步骤。

适用范围：

- 本地项目：`/Users/wyh/G/company/open-calendar`
- 树莓派地址：`192.168.48.253`
- 树莓派用户：`noonwake`
- 部署目录：`/home/noonwake/app/dist-pi/`
- 页面地址：`http://127.0.0.1:8082/pi/`

详细初始化、自启动、回滚、排障见：

- [PI_SETUP_AND_TROUBLESHOOTING.md](/Users/wyh/G/company/open-calendar/docs/PI_SETUP_AND_TROUBLESHOOTING.md)

## 发布前约定

- 构建目录固定为 `dist-pi`
- Vite `base` 固定为 `/pi/`
- nginx 提供 `/pi/`
- 打印走同源 `/printer/`

## 日常发布

### 1. 本地构建

```bash
cd /Users/wyh/G/company/open-calendar
yarn build
```

### 2. 上传产物

```bash
rsync -av --delete /Users/wyh/G/company/open-calendar/dist-pi/ noonwake@192.168.48.253:/home/noonwake/app/dist-pi/
```

说明：

- 只上传 `dist-pi/`
- `--delete` 用来清理远端旧文件

### 3. 检查页面和打印服务

```bash
curl -I http://192.168.48.253:8082/pi/
curl http://192.168.48.253:8082/printer/health
```

预期：

- `/pi/` 返回 `200`
- `/printer/health` 返回 `{"ok": true, ...}`

### 4. 需要时重启验证

```bash
ssh noonwake@192.168.48.253 "sudo reboot"
```

等待约 1 到 2 分钟后检查：

```bash
curl -I http://192.168.48.253:8082/pi/
ssh noonwake@192.168.48.253 "pgrep -af chromium; tail -20 ~/.local/state/pi-kiosk/launcher.log"
```

预期：

- Chromium 自动启动
- 日志里有 `starting kiosk url=http://127.0.0.1:8082/pi/`

## 常用命令

查看远端部署目录：

```bash
ssh noonwake@192.168.48.253 "ls -la /home/noonwake/app/dist-pi/"
```

测试打印：

```bash
curl -X POST 'http://192.168.48.253:8082/printer/print' \
  -H 'Content-Type: application/json' \
  --data '{"line1":"重启测试","line2":"流程正常"}'
```

注意：

- 打印服务要求每行正好 4 个汉字
