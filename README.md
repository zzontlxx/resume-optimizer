# 简历优化助手

一款在线简历优化工具。上传简历 → 填写目标岗位 → 获取优化建议和范文 → 下载/复制。

---

## 快速上手

### 前提条件
- 电脑上已安装 Node.js（下载地址：https://nodejs.org/）

### 运行步骤

打开终端（PowerShell 或 CMD），执行：

```
cd D:\optimize resume\backend
npm install
node server.js
```

启动成功后，打开浏览器访问 http://localhost:3001 即可。

### 如何停止
在终端按 Ctrl + C。

---

## 部署到服务器（分享给他人）

### 方案一：Render.com（免费，推荐）

**第1步：把代码上传到 GitHub**

1. 打开 https://github.com，注册账号
2. 点右上角 + → New repository
3. 名称填 resume-optimizer，点 Create repository
4. 在新页面找到 Upload an existing file
5. 打开 D:\optimize resume 文件夹，把 backend、frontend、uploads 三个文件夹以及 README.md 拖进去（不要拖 node_modules 文件夹）
6. 点 Commit changes

**第2步：在 Render 部署**

1. 打开 https://render.com，用 GitHub 登录
2. 点 New + → Web Service
3. 选你刚创建的仓库
4. 填写：
   - Root Directory: backend
   - Build Command: npm install
   - Start Command: node server.js
   - Plan: Free
5. 点 Create Web Service
6. 等 2-3 分钟，看到 Your service is live 就完成了

**第3步：发给别人**

Render 会给你一个网址，类似 https://resume-optimizer.onrender.com
把链接发给任何人，对方打开就能用。
每个人可以在网页右上角配置自己的 AI 密钥，互不影响。

### 方案二：局域网临时分享

1. 你的电脑和朋友连同一个 WiFi
2. 启动服务后，运行 ipconfig 查看你的 IP（如 192.168.1.100）
3. 朋友在浏览器输入 http://192.168.1.100:3001

---

## 文件结构

```
D:\optimize resume\
├── backend\                 # 后端代码
│   ├── server.js            # 服务入口
│   ├── evaluationEngine.js  # 简历评分+自动改写引擎
│   ├── resumeParser.js      # 简历解析
│   ├── aiService.js         # AI 服务（可选）
│   └── exporter.js          # 导出功能
├── frontend\                # 前端页面
│   ├── index.html           # 主页面
│   ├── style.css            # 样式
│   └── app.js               # 交互逻辑
├── uploads\                 # 临时文件目录
└── README.md                # 本教程
```

---

## 常见问题

**Q：上传文件提示格式不支持？**
A：目前支持 .docx 和 .pdf。图片格式的简历请先转成 Word 或 PDF。

**Q：必须配置 AI 密钥才能用吗？**
A：不是。评分、建议、自动改写、下载功能都不需要 AI 密钥。AI 密钥只用于"AI 范文生成"和"AI 个性化建议"两个功能，可选配置。

**Q：部署到 Render 后上传的文件安全吗？**
A：文件解析后会自动从服务器删除，不会保留。

**Q：部署后别人能用我的密钥吗？**
A：密钥不在服务器上，每个人在网页右上角配置自己的密钥，互不影响。
