# CupForge 免费部署指南（GitHub + Render）

把项目推到 GitHub，再用 [Render](https://render.com) 免费托管，朋友打开一个链接就能用。

---

## 你需要准备

- [GitHub](https://github.com) 账号（免费）
- [Render](https://render.com) 账号（免费，可用 GitHub 登录）
- 本机已安装 [Git](https://git-scm.com/downloads)

---

## 第一步：上传到 GitHub

在项目根目录（`文创设计` 文件夹）打开终端：

```cmd
git init
git add .
git commit -m "Initial commit: CupForge"
```

1. 打开 https://github.com/new
2. 仓库名填 `cupforge`（或你喜欢的名字）
3. 选 **Public**，不要勾选「Add README」（本地已有）
4. 点 **Create repository**

GitHub 会显示推送命令，类似：

```cmd
git remote add origin https://github.com/你的用户名/cupforge.git
git branch -M main
git push -u origin main
```

> 第一次 push 可能要求登录 GitHub（浏览器或 Personal Access Token）。

---

## 第二步：在 Render 部署

1. 登录 https://dashboard.render.com
2. 点 **New +** → **Web Service**
3. 连接 GitHub，选中刚推送的 `cupforge` 仓库
4. 填写配置：

| 选项 | 填什么 |
|------|--------|
| **Name** | `cupforge`（决定网址：`cupforge.onrender.com`） |
| **Region** | Oregon (US West) 或离你朋友近的 |
| **Branch** | `main` |
| **Runtime** | **Docker** |
| **Instance Type** | **Free** |

5. 其余保持默认，点 **Create Web Service**

Render 会自动读根目录的 `Dockerfile`，大约 **5～15 分钟** 完成首次构建。

---

## 第三步：拿到链接发给朋友

部署成功后，页面顶部会显示：

```text
https://cupforge.onrender.com
```

（实际名称取决于你在 Render 填的 Name）

把这个链接发给朋友，用 Chrome / Edge 打开即可，无需安装任何东西。

---

## 免费版注意事项

| 现象 | 说明 |
|------|------|
| **冷启动** | 15 分钟没人访问会休眠，再次打开要等 **30～60 秒** |
| **内存** | 免费 512MB，上传大图可能较慢，建议图片 &lt; 2MB |
| **会话丢失** | 服务器重启后，之前上传的会话会失效，需重新上传 |
| **每月额度** | 免费约 750 小时/月，个人分享够用 |

---

## 更新网站

改完代码后：

```cmd
git add .
git commit -m "描述你的修改"
git push
```

Render 检测到 push 后会**自动重新部署**（约 5～10 分钟）。

---

## 本地验证生产模式（可选）

想先确认「一个端口同时跑前后端」是否正常：

```cmd
cd frontend
npm run build
cd ..\backend
venv\Scripts\activate.bat
set PORT=8000
python main.py
```

浏览器打开 http://localhost:8000 ，应能看到完整应用。

---

## 常见问题

**构建失败 `npm ci`**

- 确保 `frontend/package-lock.json` 已提交到 GitHub。

**打开页面显示「后端服务未连接」**

- 等部署状态变为 **Live** 后再试。
- 在 Render 日志里看是否有 Python/OpenCV 报错。

**上传很慢或失败**

- 免费实例 CPU 有限，稍等或换小一点的图片。

**想换域名**

- Render 免费版可在 Settings → Custom Domain 绑定自己的域名（需自行购买域名）。

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `Dockerfile` | 构建前端 + 安装 Python 依赖 + 启动服务 |
| `render.yaml` | Render 蓝图（可选，手动创建 Web Service 时可忽略） |
| `backend/main.py` | 生产环境托管 `frontend/dist` 静态文件 |

开发时仍用原来的双终端方式（`npm run dev` + `python main.py`），互不影响。
