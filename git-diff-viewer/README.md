# Paseo Git Diff Viewer

A Paseo plugin that shows the Git repositories of a workspace, their uncommitted changes, and their commit history.

## Features

- Scans the workspace for Git repositories and lists branch, upstream tracking status, change counts, and the latest commit.
- Switches between repositories from a dropdown, with path search.
- Changes view: per-file diffs with line numbers and full-row add/delete backgrounds, plus added and deleted line totals.
- Two scopes: uncommitted work in the working tree (staged, unstaged, and untracked) and upstream versus local HEAD.
- Full file content view alongside the diff for every file.
- History view: browse local and remote branch history, read commit messages, and inspect the files a commit changed.
- Read-only. The plugin never modifies a repository, switches branches, or uploads code.

## Requirements

- Git installed on the machine that runs the Paseo daemon.
- A workspace directory inside a Git repository. The plugin also detects sibling repositories when the workspace directory itself holds no repository, after asking for confirmation.

## Install

Install directly from the public GitHub monorepo (the suffix selects the plugin subdirectory):

```bash
paseo plugin install github:huang-x-h/paseo-plugins:git-diff-viewer
paseo plugin ls
```

The plugin is installed on the daemon selected by the CLI. The Paseo client must be connected to that same daemon. Once installed and running, open the **Git 仓库** panel in a workspace or Explorer.

## Develop

```bash
npm install
npm run typecheck
npm test
paseo plugin install /absolute/path/to/git-diff-viewer
paseo plugin reload git-diff-viewer
```

## License

Apache-2.0
