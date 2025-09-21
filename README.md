# Shanghai TextBook Downloader

A tool to download Shanghai textbooks from the official platform. This project automatically fetches, downloads, decrypts, and organizes textbook files.

## 功能特点 (Features)

- 🔐 自动获取和处理教科书认证令牌
- 📚 批量下载上海市教科书
- 🔓 自动解密 PDF 文件
- 📁 智能文件管理和组织
- 📄 大文件自动分割处理
- 🖼️ 自动提取封面图片
- ⚡ 并发下载优化

## 项目结构 (Project Structure)

```
shanghai-textbook/
├── src/
│   ├── index.ts          # 主入口文件
│   ├── server.ts         # 服务器 API 交互
│   ├── token.ts          # 认证令牌管理
│   ├── bookProcess.ts    # 书籍处理逻辑
│   ├── types.ts          # TypeScript 类型定义
│   └── pdf/
│       └── decrypt.ts    # PDF 解密功能
├── books/                # 下载的书籍存储目录
├── package.json
├── tsconfig.json
└── README.md
```

## 安装 (Installation)

### 前置要求

- Node.js >= 16
- pnpm (推荐) 或 npm

### 安装步骤

```bash
# 克隆项目
git clone https://github.com/langningchen/shanghai-textbook.git
cd shanghai-textbook

# 安装依赖
pnpm install
# 或使用 npm
npm install

# 构建项目
pnpm run build
# 或使用 npm
npm run build
```

## 使用方法 (Usage)

### 运行程序

```bash
# 开发模式运行
pnpm run dev

# 或先构建再运行
pnpm run build
pnpm start
```

### 程序运行流程

1. **获取书架数据**: 程序首先连接到上海教育平台获取可用教科书列表
2. **批量处理**: 遍历所有教科书进行下载和处理
3. **文件解密**: 自动获取解密密钥并解密 PDF 文件
4. **文件管理**: 
   - 保存书籍元数据 (JSON 格式)
   - 提取并保存封面图片 (JPG/PNG)
   - 处理大文件分割 (超过 50MB 的文件会被分割)
5. **清理临时文件**: 自动清理下载过程中的临时文件

## 输出文件说明 (Output Files)

下载完成后，`books/` 目录将包含以下文件：

```
books/
├── bookcase.json                    # 书架总目录
├── {book-uuid}.json                # 单本书的元数据
├── {book-uuid}.pdf                 # 解密后的 PDF 文件
├── {book-uuid}.pdf.1               # 大文件分割部分 (如需要)
├── {book-uuid}.pdf.2               # 大文件分割部分 (如需要)
├── {book-uuid}.jpg/.png            # 书籍封面图片
└── ...
```

## 开发脚本 (Development Scripts)

```bash
# 构建项目
pnpm run build

# 运行项目
pnpm start

# 开发模式 (构建+运行)
pnpm run dev

# 类型检查
pnpm run type-check

# 代码检查
pnpm run lint

# 清理构建文件
pnpm run clean

# 完整设置 (安装依赖+构建)
pnpm run setup
```

## 技术栈 (Tech Stack)

- **TypeScript**: 主要开发语言
- **Node.js**: 运行时环境
- **@clack/prompts**: 命令行交互界面
- **adm-zip**: ZIP 文件处理
- **pdfkit**: PDF 处理
- **xml2js**: XML 解析
- **p-limit**: 并发控制

## 依赖说明 (Dependencies)

### 核心依赖
- `@clack/prompts`: 提供美观的命令行界面
- `adm-zip`: 处理下载的 ZIP 压缩包
- `mime-types`: MIME 类型识别
- `p-limit`: 控制并发下载数量
- `pdfkit`: PDF 文件处理
- `xml2js`: 解析 XML 格式的清单文件

### 开发依赖
- `typescript`: TypeScript 编译器
- `@types/*`: 类型定义文件
- `rimraf`: 跨平台文件删除工具

## 注意事项 (Notes)

⚠️ **重要提醒**:

1. 本工具仅供教育研究使用，请遵守相关版权法律法规
2. 请确保有权限访问上海教育平台的教科书资源
3. 下载的文件仅供个人学习使用，请勿用于商业用途
4. 请合理使用，避免对服务器造成过大压力

## 许可证 (License)

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献 (Contributing)

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 问题反馈 (Issues)

如果您遇到任何问题，请在 [GitHub Issues](https://github.com/langningchen/shanghai-textbook/issues) 中反馈。

---

**作者**: [langningchen](https://github.com/langningchen)

**项目主页**: [https://github.com/langningchen/shanghai-textbook](https://github.com/langningchen/shanghai-textbook)
