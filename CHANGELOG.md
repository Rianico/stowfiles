# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- **wezterm:** match package-manager/source refs in quick select
- **nvim:** migrate frontend to oxlint/oxfmt with granular pre-push auto-push
- **herdr:** add herdr agent state extension
- **permissions:** gather pi docs/examples and skill paths into read-only bypass
- **wezterm:** close kitty in wezterm due to escape key issues in herdr
- **permissions:** bypass outside-workspace guard for pi docs
- **permissions:** bypass outside-workspace guard for skill and prompt paths
- **wezterm:** enable kitty keyboard protocol
- **pi:** guard gh content publishing; symlink-aware outside-workspace gate
- **pi:** add tools-view extension — /tools window listing tools grouped by extension
- **pi:** add model-info-widget extension — model/thinking/context in input border
- **keybindings:** add Snacks Words jump shortcuts for next/previous references
- **snacks:** enable words plugin with navigation and buffer filtering
- **dotfiles:** add Powerlevel10k configuration file
- **README:** add installation instructions for git-worktree-runner and rtk
- **dotfiles:** add zoxide integration and custom yazi alias with gtr support
- **lsp:** add blink.cmp capabilities and update blink keymap
- **zsh-abbr:** add 'ccr cw' abbreviation

### Bug Fixes

- **pi-lens:** migrate deprecated LSP config to canonical locations
- **permissions:** suppress knip false positives for permission entry points
- **permissions:** address review nits and knip false positives

### Performance Improvements

- **pi:** cache rtk rewrite results in rtk extension

### Documentation

- **README:** update Claude Code setup instructions and add critical configuration steps
