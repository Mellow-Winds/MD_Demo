# Design Demo

一个只展示设计语言的网页项目，使用原生 JavaScript 模块与自定义 MD3 风格组件。界面包含四个独立页面：总览、细节、温度、细则。

## 启动

```powershell
npm install
npm run dev
```

打开 http://localhost:3000 。自定义端口：

```powershell
$env:PORT=3100
npm run dev
```

当前入口为 `showcase-server.cjs`，只提供静态文件与设计规范，不初始化数据库，也不挂载业务接口。旧业务运行时已移除。

## 内容

- 总览：同一窗口同时操作普通、增强、玻璃三种卡片里的颜色、按钮、输入、菜单和切换。
- 细节：按钮、输入、下拉、开关、标签页、弹窗、卡片、进度；复制源码或下载可独立运行的示例。
- 温度：真实富文本、自定义署名与卡片、增减与排序、实时预览、本机草稿及内容导出。
- 细则：`develop/design.md` 的十二章，目录在章节切换时持续可用。

只有四个基础色。深色主按钮采用基础色混合并搭配浅色文字；状态不引入额外红绿橙色。分段切换只保留有界涟漪，没有滑动背景。所有非必要动画响应系统减少动态效果设置。

细节顶部可切换三种全局材质。卡片页按普通、增强、玻璃三排展示，玻璃预览右侧提供“卡片调整”：模糊、厚度、降低透明度、减少动态效果与恢复默认；设置本机保存。玻璃输入区使用不透光的增强卡片，避免标签遮罩与背景色差。玻璃层次与可访问性回退参考 apple-design 技能。

## 验证

```powershell
npm run check
npm test
npm run test:browser
```

这是无需打包的原生网页项目；`check` 检查入口与共享模块语法，`test` 验证真实静态服务、工厂函数、四色约束和对比度。

浏览器回归使用 Chrome 自带的调试协议，不使用 Playwright。先在 3100 端口启动展示服务，再启动隔离的测试浏览器：

```powershell
$browserProfile = Join-Path $env:TEMP ('design-demo-test-' + [guid]::NewGuid())
Start-Process 'C:/Program Files/Google/Chrome/Application/chrome.exe' -WindowStyle Hidden -ArgumentList @('--headless=new', '--remote-debugging-port=9222', ('--user-data-dir=' + $browserProfile), '--no-first-run', 'about:blank')
npm run test:browser
```

该测试浏览器使用临时配置，不读取日常浏览器资料。浏览器回归会操作本机演示草稿、检查主要展示页面与四种视口，并将截图及独立示例保存到被忽略的 `test-results/`。

当前仓库只保留 Design Demo 的展示验收，不再提供旧业务测试入口。

## 主要文件

- `public/index.html`：页面骨架。
- `public/js/pages/showcase.js`：四页及编辑逻辑。
- `public/js/pages/gallery.js`：总览、七类细节及材质调整交互。
- `public/css/gallery.css`：综合展示、代码卡片与响应式材质。
- `public/js/components/design-controls.js`：共享控件与安全内容处理。
- `public/css/style.css`：统一样式。
- `develop/design.md`：设计合同、来源和验收清单。
- `scripts/gallery-browser-check.cjs`：控件、材质、编辑器、独立下载与响应式回归。
- `showcase-server.cjs`：只读服务。

## 范围

草稿只保存在当前浏览器；图片仅在本机处理，存储空间不足时可导出文件。没有在线发布、账号或多人协作，也不是完整文档处理器。

设计原则参考 [Material Design 状态规范](https://m3.material.io/foundations/interaction/states/overview) 与 [Apple 人机界面指南](https://developer.apple.com/design/human-interface-guidelines/accessibility)。这是独立实现，不是官方组件库。
