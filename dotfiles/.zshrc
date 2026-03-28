eval "$(zellij setup --generate-auto-start zsh)"

# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

if [[ -f "/opt/homebrew/bin/brew" ]] then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# https://github.com/dreamsofautonomy/zensh/blob/main/.zshrc
# https://www.youtube.com/watch?v=ud7YxC33Z3w&ab_channel=DreamsofAutonomy
# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
   mkdir -p "$(dirname $ZINIT_HOME)"
   git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# Add in Powerlevel10k
zinit ice depth"1" # git clone depth
zinit light romkatv/powerlevel10k

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Add in zsh plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab
zinit light olets/zsh-abbr

# Add in snippets, more refer to https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins
## ga: git add, gapa: git add -p
## gb: git branch, gba: git branch --all, gbr: git branch --remote
## gc: git commit
## gd: git diff, gds: git diff --staged
## glg: git log, glgg: git log --graph
## gm: git merge, gma: git merge --abort, gmc: git merge --continue
## grb: git rebase, grbc, grba
## gl: git pull, gp: git push
## gf: git fetch
## gsw: git switch, gswc: git switch -c
## gstl: git stash list, gstp: pop, gsta: apply, gstall: git stash --all
zinit snippet OMZP::git

zinit snippet OMZP::command-not-found

# fzf
[ -f ~/.fzf.zsh ] && source ~/.fzf.zsh
# prefix: ctrl-g, f: files, b: branches, t: tags, r: remotes
# l: reflogs, h: hashes, e: each ref, s: stashes,
[ -f ~/fzf-git.sh ] && source ~/fzf-git.sh
export FZF_DEFAULT_COMMAND="fd --hidden --strip-cwd-prefix --exclude .git --exclude .github" 
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_CTRL_T_OPTS="
  --prompt 'Files> ' \
  --header 'CTRL-T: Switch between Files/Directories' \
  --bind 'ctrl-t:transform:[[ ! \$FZF_PROMPT =~ Files ]] && echo \"change-prompt(Files> )+reload(fd --type file)\" ||
          echo \"change-prompt(Directories> )+reload(fd --type directory)\"' \
  --preview '[[ \$FZF_PROMPT =~ Files ]] && bat --color=always {} || tree -C {}' \
  --walker-skip .git,node_modules,target"
export FZF_CTRL_R_OPTS="
  --bind 'ctrl-y:execute-silent(echo -n {2..} | pbcopy)+abort'
  --color header:italic
  --header 'Press CTRL-Y to copy command into clipboard'"
export FZF_ALT_C_OPTS="
  --walker-skip .git,node_modules,target
  --preview 'tree -C {}'"
RG_PREFIX="rg --column --line-number --no-heading --color=always --smart-case "
INITIAL_QUERY="${*:-}"
alias fzfr="fzf --ansi --disabled --query \"\$INITIAL_QUERY\" \
    --bind \"start:reload:\$RG_PREFIX {q}\" \
    --bind \"change:reload:sleep 0.1; \$RG_PREFIX {q} || true\" \
    --bind 'ctrl-t:transform:[[ ! \$FZF_PROMPT =~ ripgrep ]] && \
      echo \"rebind(change)+change-prompt(1. ripgrep> )+disable-search+transform-query:echo {q} > /tmp/rg-fzf-f; cat /tmp/rg-fzf-r\" || \
      echo \"unbind(change)+change-prompt(2. fzf> )+enable-search+transform-query:echo {q} > /tmp/rg-fzf-r; cat /tmp/rg-fzf-f\"' \
    --color \"hl:-1:underline,hl+:-1:underline:reverse\" \
    --prompt '1. ripgrep> ' \
    --delimiter : \
    --header 'CTRL-T: Switch between ripgrep/fzf' \
    --preview 'bat --color=always {1} --highlight-line {2}' \
    --preview-window 'up,60%,border-bottom,+{2}+3/3,~3' \
    --bind 'enter:become(vim {1} +{2})'"
alias fzfa="abbr list | fzf"
zinit snippet OMZP::fzf
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no

# Load completions
autoload -Uz compinit && compinit

# Keybindings
bindkey -e
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward


# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

# timeout
KEYTIMEOUT=80

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
[[ -f ~/.viinfo ]] && source ~/.viinfo

export COLORTERM=truecolor

# Homebrew
# export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.ustc.edu.cn/brew.git"
# export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.ustc.edu.cn/homebrew-core.git"
# export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/bottles"

# neovim
alias vim='nvim'
alias vi='nvim'
alias vimf="vim \$(fd --type file --exclude target  . ./ | fzf)"

alias cat='bat'
export MANPAGER="sh -c 'col -bx | bat -l man -p'"

alias ls='eza'
alias ll='eza -l'
alias la='eza -la'

alias llmg='f() { llm "$1" | glow -; }; f'

export DOCKER_DEFAULT_PLATFORM=linux/arm64

export https_proxy=http://127.0.0.1:7897 http_proxy=http://127.0.0.1:7897

source /Users/zhengxk/.tools/merge_video.zsh

# Created by `pipx` on 2025-02-11 04:33:06
export PATH="$PATH:/Users/zhengxk/.local/bin"
export XDG_CONFIG_HOME="$HOME/.config"

# abbr behavior
ABBR_QUIET=1
ABBR_GET_AVAILABLE_ABBREVIATION=1
ABBR_LOG_AVAILABLE_ABBREVIATION=1
# if ~/.config/zsh-abbr/user-abbreviations is empty, then impot aliases
if [ ! -s "$HOME/.config/zsh-abbr/user-abbreviations" ]; then
  abbr import-aliases
fi

## zoxide
ZOXIDE_CMD_OVERRIDE='cd'
zinit snippet OMZP::zoxide
