# 企业文化考试系统（culture-exam）

面向员工的企业文化在线考试系统：填写姓名 → 随机抽卷 → 在线答题 → 服务端自动判分 → 展示错题与排行榜。题库与成绩存放在飞书多维表格，前端部署在腾讯云 EdgeOne Makers（免费档）。

## 技术栈

- **前端**：Next.js 14（Pages Router，`output: "export"` 静态导出）+ React 18
- **后端接口**：EdgeOne Makers Functions（`functions/api/*.js`，`onRequestPost/Get` 导出）
- **数据存储**：飞书多维表格（Bitable），通过 OpenAPI 读写
- **部署**：EdgeOne Makers CLI 直接上传（非 GitHub 自动部署）

## 目录结构

```
├── pages/                  # 前端页面
│   ├── index.jsx           # 首页：填写姓名，开始考试
│   ├── exam.jsx            # 答题页：填空/判断/简答三类分组渲染
│   ├── result.jsx          # 结果页：总分、分类得分、错题与正确答案
│   ├── rank.jsx            # 排行榜：按分数/姓名排序
│   └── _app.jsx            # 全局样式挂载
├── functions/api/          # EdgeOne Functions（后端接口）
│   ├── paper.js            # POST /api/paper   随机抽卷（不下发答案）
│   ├── submit.js           # POST /api/submit  判分并写入成绩表
│   ├── rank.js             # GET  /api/rank    按姓名取最高分排行
│   ├── _shared.js          # 飞书 API 封装 + 边缘缓存 + 响应工具
│   └── _env.js             # 本地兜底环境变量（已 gitignore，含飞书凭证）
├── lib/                    # 本地调试用工具（生产未引用）
│   ├── grading.js          # 抽题 + 判分逻辑（与 submit.js 内联逻辑对应）
│   └── feishu.js           # 飞书客户端（旧版，已弃用）
├── build_bank.py           # 解析 docx 题库 → CSV/JSON（离线工具）
├── import_to_feishu.mjs    # 将题库 JSON 导入飞书多维表格（离线工具）
└── test_grade.mjs          # 判分逻辑本地单测
```

## 抽题与判分规则

**抽题**（`functions/api/paper.js`）：

| 题型 | 数量 | 分值 | 合计 |
|------|------|------|------|
| 填空（fill） | 20 | 2 | 40 |
| 判断（tf） | 10 | 2 | 20 |
| 简答（short） | 5 | 5 | 25 |
| **单卷满分** | | | **85** |

服务端随机抽样（题池不足时放回抽样补足），`paper_id` 为所选题目 ID 的 JSON 数组，交卷时据此回取标准答案判分。

**判分**（`functions/api/submit.js`）：

- **填空/判断**：去除空格、标点、大小写后精确比对；`answer` 字段支持 `|` 分隔多个正确答案。
- **简答**：按 `keywords`（逗号分隔）关键词命中率给分，`得分 = round(分值 × 命中率)`，命中率 ≥ 60% 判定正确。

## 数据存储（飞书多维表格）

题库表字段：`q_type`（fill/tf/short）、`content`（题干）、`opt_a~d`（选择题遗留，已弃用）、`answer`、`keywords`、`score`

成绩表字段：`name`、`paper_id`、`single_score`（实际存填空分）、`tf_score`、`short_score`、`total_score`、`wrong_detail`、`created_at`

## 环境变量

本地开发填入 `functions/api/_env.js`（已被 gitignore），生产环境在 EdgeOne 控制台「环境变量」配置同名变量：

| 变量 | 说明 |
|------|------|
| `FEISHU_APP_ID` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用 App Secret |
| `FEISHU_APP_TOKEN` | 多维表格 base 的 app_token |
| `FEISHU_Q_TABLE` | 题库表 table_id |
| `FEISHU_S_TABLE` | 成绩表 table_id |

> 优先级：控制台环境变量 > `_env.js` > `process.env`。
> 密钥安全建议：飞书 Secret 当前明文存在于 `_env.js`（随部署打包），建议在飞书开放平台重置 Secret 并改用控制台环境变量。

## 本地开发

```bash
npm install
npm run build    # 生成静态产物 out/
```

> 注意：`/api/*` 由 EdgeOne Functions 提供，本地 `next dev` 无法直接调用接口；需使用 EdgeOne 本地调试（`edgeone makers dev`）或直接部署后验证。

## 部署（EdgeOne Makers）

项目为 **EdgeOne Makers CLI 直接上传**类型（非 GitHub 自动部署），改代码后需手动部署：

```bash
# 安装 CLI
npm install -g edgeone

# 登录（一次性）
edgeone login

# 部署到生产环境
edgeone makers deploy -n culture-exam -e production
```

- 项目名：`culture-exam`，ProjectId：`makers-xrgc5lbtjajr`
- 部署域名：`culture-exam-uejexxlo.edgeone.cool`（临时预览域名）

> ⚠️ 预览域名 token（`?eo_token=...&eo_time=...`）有效期约 2~3 分钟，频繁过期。正式使用请绑定自定义域名。
> ⚠️ 题库/成绩有边缘缓存（题库 10 分钟、成绩 60 秒），题库更新后最长 10 分钟生效。

## 题库维护

日常维护无需改代码，直接在飞书多维表格题库表增删改即可。

批量导入题库（离线工具）：

```bash
python build_bank.py        # 解析 docx → 题库.json / 题库导入.csv
node import_to_feishu.mjs   # 清空旧题库并批量写入飞书
```

判分逻辑本地单测：

```bash
node test_grade.mjs
```
