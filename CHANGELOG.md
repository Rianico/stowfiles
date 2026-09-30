# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- **permissions:** open push for new branches, close for deletion (#4)
- **permissions:** bypass read-only gate for tmp and agent git cache (#4)
- **nvim:** add shellcheck and wire shfmt/shellcheck for shell scripts (#4)
- **permissions:** replace git commit guard with git reset --hard (#3)
- **wezterm:** match package-manager/source refs in quick select (#4)
- **nvim:** migrate frontend to oxlint/oxfmt with granular pre-push auto-push (#4)
- **herdr:** add herdr agent state extension (#4)
- **permissions:** gather pi docs/examples and skill paths into read-only bypass (#4)
- **wezterm:** close kitty in wezterm due to escape key issues in herdr (#4)
- **permissions:** bypass outside-workspace guard for pi docs (#4)
- **permissions:** bypass outside-workspace guard for skill and prompt paths (#4)
- **wezterm:** enable kitty keyboard protocol (#4)
- **pi:** guard gh content publishing; symlink-aware outside-workspace gate (#4)
- **pi:** add tools-view extension — /tools window listing tools grouped by extension (#4)
- **pi:** add model-info-widget extension — model/thinking/context in input border (#4)
- **keybindings:** add Snacks Words jump shortcuts for next/previous references (#4)
- **snacks:** enable words plugin with navigation and buffer filtering (#4)
- **dotfiles:** add Powerlevel10k configuration file (#4)
- **README:** add installation instructions for git-worktree-runner and rtk (#4)
- **dotfiles:** add zoxide integration and custom yazi alias with gtr support (#4)
- **lsp:** add blink.cmp capabilities and update blink keymap (#4)
- **zsh-abbr:** add 'ccr cw' abbreviation (#4)

### Bug Fixes

- **nvim:** migrate markdown formatter from mdformat to oxfmt (#4)
- **nvim:** preserve frontmatter and list numbering in mdformat (#4)
- **pi-lens:** migrate deprecated LSP config to canonical locations (#4)
- **permissions:** suppress knip false positives for permission entry points (#4)
- **permissions:** address review nits and knip false positives (#4)

### Performance Improvements

- **pi:** cache rtk rewrite results in rtk extension (#4)

### Documentation

- **README:** update Claude Code setup instructions and add critical configuration steps (#4)
