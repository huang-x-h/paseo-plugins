# paseo-plugins

Paseo 插件集合。

## git-diff-viewer

工作区 Git 面板：多仓库扫描与切换、工作区未提交改动 diff、本地与源端分支比较、分支历史与提交详情。

安装：

```bash
paseo plugin add git-diff-viewer
```

本地开发：

```bash
cd git-diff-viewer
npm install
npm run typecheck
node tests/history.cjs
paseo plugin install /absolute/path/to/git-diff-viewer
paseo plugin reload git-diff-viewer
```
