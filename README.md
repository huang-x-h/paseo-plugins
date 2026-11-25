# paseo-plugins

Paseo 插件集合。

## git-diff-viewer

工作区 Git 面板：多仓库扫描与切换、工作区未提交改动 diff、本地与源端分支比较、分支历史与提交详情。

直接从 GitHub 安装（仓库包含多个目录，`:git-diff-viewer` 指定插件目录）：

```bash
paseo plugin install github:huang-x-h/paseo-plugins:git-diff-viewer
paseo plugin ls
```

插件安装在命令连接的 Paseo daemon 上；请确保 Paseo 客户端连接的是同一个 daemon。安装后在工作区面板或 Explorer 中打开“Git 仓库”。

本地开发：

```bash
cd git-diff-viewer
npm install
npm run typecheck
node tests/history.cjs
paseo plugin install /absolute/path/to/git-diff-viewer
paseo plugin reload git-diff-viewer
```
