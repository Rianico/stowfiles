# Crab_Blade's Dotfiles and Development Environment

This repository contains my personal dotfiles and development environment configurations managed using GNU Stow. It includes configurations for various tools and applications I use daily, as well as Claude Code skills and development utilities.

## Overview

This project serves as my personal development environment setup, featuring:

- **Dotfiles management** using GNU Stow for easy deployment across machines
- **Neovim configuration** with extensive plugin management and LSP support
- **Terminal enhancements** including ZSH, WezTerm, and Zellij configurations
- **macOS window management** with Aerospace and status bar with SketchyBar
- **Claude Code skills** for enhanced AI-assisted development workflows
- **Development tools and scripts** for various tasks

## Directory Structure

- `dotfiles/` - Core configuration files for various tools
  - `.config/nvim/` - Neovim configuration with Lua-based plugins and LSP
  - `.config/wezterm/` - WezTerm terminal emulator configuration
  - `.config/zellij/` - Zellij terminal multiplexer configuration
  - `.config/sketchybar/` - macOS status bar customization
  - `.config/aerospace/` - Window manager for macOS
  - `.config/borders/` - Visual window borders for aerospace
  - `.zshrc` - ZSH shell configuration
- `claude-skills/` - Claude Code skills for AI-assisted development
- `.tools/` - Custom utility scripts

## Features

### Neovim Configuration
- Modern Neovim setup with plugin management via lazy.nvim
- Full LSP support with conform.lua, mason.nvim, and lspsaga
- Tree-sitter integration for syntax highlighting
- Debug adapter protocol (DAP) support
- Git integration and various productivity plugins

### Terminal Environment
- ZSH with custom abbreviations and aliases
- WezTerm configuration with optimized settings
- Zellij for terminal session management
- Modern command-line tools (bat, eza, fzf, ripgrep, zoxide)

### macOS Enhancement
- Aerospace as tiling window manager
- SketchyBar for customizable status bar
- Borders for visual window focus indicators

### Claude Code Integration
- Custom skills for enhanced AI assistance
- Skill management system with installation script
- Various specialized skills for different development tasks

## Installation

To set up this environment:

1. Install GNU Stow:
   ```bash
   # On macOS
   brew install stow

   # On Ubuntu/Debian
   sudo apt-get install stow
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/crab-blade/dotfiles.git
   cd dotfiles
   ```

3. Use Stow to deploy configurations:
   ```bash
   # Deploy all configurations
   stow dotfiles

   # Or deploy specific configurations
   stow dotfiles/.config/nvim
   stow dotfiles/.zshrc
   ```

4. Install additional tools mentioned in the original README:
   ```bash
   # Install essential tools
   brew install bat eza zoxide fzf tldr fd ripgrep broot pass
   brew install switchaudio-osx

   # Install aerospace (macOS window manager)
   brew install --cask nikitabobko/tap/aerospace

   # Install sketchybar (macOS status bar)
   brew tap FelixKratz/formulae
   brew install sketchybar
   brew install borders

   # Install fonts
   brew install --cask font-hack-nerd-font
   brew install font-sf-pro
   brew install sf-symbols
   curl -L https://github.com/kvndrsslr/sketchybar-app-font/releases/download/v1.0.16/sketchybar-app-font.ttf -o $HOME/Library/Fonts/sketchybar-app-font.ttf
   ```

5. Set up Claude Code skills:
   ```bash
   ./claude-skills/claude-skills.sh install
   ```

6. Apply extra settings:
   ```bash
   git config --global core.excludesfile ~/.gitignore_global
   ```

## Customization

Most configurations can be customized by modifying the respective files in the `dotfiles/` directory before deployment. Key files to customize include:

- `.zshrc` - Shell configuration
- `.config/nvim/` - Neovim settings
- `.config/wezterm/wezterm.lua` - Terminal configuration
- `.config/aerospace/aerospace.toml` - Window manager settings

## License

This project is licensed under the terms specified in the individual configuration files. Most configurations are provided as-is for personal use.

## Contributing

These configurations are tailored to my personal workflow and preferences. While suggestions are welcome, changes that significantly alter the core functionality may not be accepted as this is primarily a personal environment repository.
