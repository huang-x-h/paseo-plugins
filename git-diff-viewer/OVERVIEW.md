# Git repository viewer

Inspect the Git repositories that belong to a workspace without leaving Paseo. The panel scans the workspace for repositories, shows each repository's branch, upstream tracking status, change counts, and latest commit, and lets you switch between them from a dropdown.

Changes view. Lists the files that differ in the selected scope, shows how many lines were added and removed, and expands a file into its diff. The scope is either uncommitted work in the working tree, which includes staged, unstaged, and untracked files, or the difference between the upstream branch and local HEAD. The upstream scope only appears when the current branch has an upstream tracking branch, and it compares the two commit snapshots without running a fetch. Each file offers a diff view and a full content view.

History view. Browse the commit history of any local or remote branch, read a commit message, and inspect the files it changed.

Requirements. Git must be installed on the machine that runs the daemon, and the workspace directory must sit inside a Git repository. The scan walks up to four levels below the workspace, skips dependencies and common build directories, and never follows directory symlinks. When the workspace directory contains no repository, the plugin lists parent directories that do and asks before scanning them, so unrelated repositories are never pulled in silently.

The plugin runs read-only Git commands and reads untracked files. It does not upload code, modify a repository, or switch branches. Binary files are not previewed, files over 200KB or 5000 lines show only the beginning, and diffs longer than 200,000 characters are truncated.
