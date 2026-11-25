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

From a Git repository:

```bash
paseo plugin install github:owner/repository
```

From npm:

```bash
paseo plugin install npm:@scope/paseo-git-diff-viewer
```

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
