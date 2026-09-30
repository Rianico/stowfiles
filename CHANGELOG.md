# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- **pi:** add env injector with cache-safe static-dynamic split (#5)
- **permissions:** refine push gate and read-only bypass (#4)
- **nvim:** add shellcheck and wire shfmt/shellcheck for shell scripts (#5)
- **permissions:** replace git commit guard with git reset --hard (#3)
- **wezterm:** match package-manager/source refs in quick select (#5)
- **nvim:** migrate frontend to oxlint/oxfmt with granular pre-push auto-push (#5)
- **herdr:** add herdr agent state extension (#5)
- **permissions:** gather pi docs/examples and skill paths into read-only bypass (#5)
- **wezterm:** close kitty in wezterm due to escape key issues in herdr (#5)
- **permissions:** bypass outside-workspace guard for pi docs (#5)
- **permissions:** bypass outside-workspace guard for skill and prompt paths (#5)
- **wezterm:** enable kitty keyboard protocol (#5)
- **pi:** guard gh content publishing; symlink-aware outside-workspace gate (#5)
- **pi:** add tools-view extension — /tools window listing tools grouped by extension (#5)
- **pi:** add model-info-widget extension — model/thinking/context in input border (#5)
- **keybindings:** add Snacks Words jump shortcuts for next/previous references (#5)
- **snacks:** enable words plugin with navigation and buffer filtering (#5)
- **dotfiles:** add Powerlevel10k configuration file (#5)
- **README:** add installation instructions for git-worktree-runner and rtk (#5)
- **dotfiles:** add zoxide integration and custom yazi alias with gtr support (#5)
- **lsp:** add blink.cmp capabilities and update blink keymap (#5)
- **zsh-abbr:** add 'ccr cw' abbreviation (#5)

### Bug Fixes

- **nvim:** migrate markdown formatter from mdformat to oxfmt (#5)
- **nvim:** preserve frontmatter and list numbering in mdformat (#5)
- **pi-lens:** migrate deprecated LSP config to canonical locations (#5)
- **permissions:** suppress knip false positives for permission entry points (#5)
- **permissions:** address review nits and knip false positives (#5)

### Performance Improvements

- **pi:** cache rtk rewrite results in rtk extension (#5)

### Documentation

- **README:** update Claude Code setup instructions and add critical configuration steps (#5)
