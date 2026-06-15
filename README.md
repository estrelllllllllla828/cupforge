# 筑纹杯 CupForge

面向工业建造文化的纹样设计与 3D 杯具定制系统：传统 CV 特征提取 + 前端 Canvas 实时阵列 + 杯型/浮雕 3D 预览。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3, OpenCV, scikit-learn, FastAPI, trimesh |
| 前端 | React, TypeScript, Canvas, Three.js |

## 项目结构

```
├── backend/
│   ├── config.py              # 算法与杯型参数
│   ├── main.py                # API 入口
│   ├── pipeline/
│   │   ├── preprocess.py      # 上传预处理 + 主题识别
│   │   ├── expressions.py     # 视觉形态（线稿/像素/半调等）
│   │   ├── industrial_recognize.py
│   │   └── cup_mesh.py        # 光滑杯型 OBJ/STL（贴图流程）
│   └── scripts/
│       └── generate_test_images.py
├── frontend/src/
│   ├── pages/                 # 首页 / 上传 / 方案 / 纹样 / 3D / 浮雕
│   ├── components/
│   ├── engine/                # 阵列、浮雕、STL 导出等
│   └── styles/
└── test_library/              # 可选测试图库（开发脚本生成）
```

## 快速启动

```cmd
# 后端
cd backend
venv\Scripts\activate.bat
python main.py

# 前端
cd frontend
npm run dev
```

浏览器访问 `http://localhost:5173`

## 工作流

1. **上传** → 自动识别工业主题，选择贴图或浮雕流程  
2. **方案页** → 挑选随机生成的纹样方案  
3. **纹样编辑** → 取样框、阵列、配色、实时预览  
4. **3D 预览（贴图）** → 杯型 + 纹样贴附，导出光滑 STL  
5. **浮雕工作室** → 线稿浮雕 + 3D 预览，**导出带浮雕细节的 STL**（前端生成，可 3D 打印）

## 导出说明

| 场景 | 导出方式 |
|------|----------|
| 贴图 3D 页 | 后端 API → 光滑杯壁 STL/OBJ |
| 浮雕页 | 前端 `cupStlExport.ts` → 含纹样浮雕的 STL |

参数阈值集中在 `backend/config.py`。

## 在线部署（免费）

详见 **[DEPLOY.md](./DEPLOY.md)**：推送到 GitHub → Render Docker 部署 → 分享链接给朋友。
