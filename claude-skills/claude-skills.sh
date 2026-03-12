#!/bin/bash

# Claude Skills Installation Script
# Install or uninstall Claude skills using stow with customizable target directory and packages

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

# Default values
DEFAULT_PACKAGE="general"
DEFAULT_TARGET="$HOME/.claude/skills"

# Function to display help information
show_help() {
    cat << EOF
Usage: $SCRIPT_NAME [COMMAND] [OPTIONS]

Install or uninstall Claude skills using stow with customizable target directory and packages.
Packages containing slashes (e.g., category/package) are handled with direct symbolic links.

COMMANDS:
    install              Install packages (default if no command specified)
    uninstall            Uninstall packages

OPTIONS:
    -t, --target PATH     Target directory for stowing skills (default: $DEFAULT_TARGET)
    -p, --packages PKGS   Space-separated list of packages to install/uninstall (default: $DEFAULT_PACKAGE for install)
    -h, --help           Show this help message

EXAMPLES:
    $SCRIPT_NAME install                              # Install 'general' package to ~/.claude/skills
    $SCRIPT_NAME install -t /custom/path              # Install 'general' package to /custom/path
    $SCRIPT_NAME install -p package1 package2         # Install multiple packages to default location
    $SCRIPT_NAME install -t /custom/path -p pkg1 pkg2 # Install multiple packages to custom location
    $SCRIPT_NAME install -p category/package          # Install 'category/package' with direct symlink
    $SCRIPT_NAME install -p category/pkg1 pkg2        # Install mixed packages (direct symlink + stow)
    $SCRIPT_NAME uninstall -p package1                # Uninstall package1 from ~/.claude/skills
    $SCRIPT_NAME uninstall -t /custom/path -p pkg1    # Uninstall package1 from custom location
    $SCRIPT_NAME uninstall -p category/package        # Uninstall 'category/package' direct symlink
EOF
}

# Initialize variables
MODE="install"  # Default mode
TARGET_DIR=""
PACKAGES=()

# Parse the first argument as a command if it's not an option
if [[ $# -gt 0 && "$1" != -* ]]; then
    case "$1" in
        install|uninstall)
            MODE="$1"
            shift
            ;;
        *)
            echo "Unknown command: $1" >&2
            show_help
            exit 1
            ;;
    esac
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET_DIR="$2"
            shift 2
            ;;
        -p|--packages)
            shift
            # Collect all remaining arguments until we hit another flag or run out
            while [[ $# -gt 0 && ! "$1" =~ ^- ]]; do
                PACKAGES+=("$1")
                shift
            done
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            show_help
            exit 1
            ;;
    esac
done

# Set default values if not provided
if [[ -z "$TARGET_DIR" ]]; then
    TARGET_DIR="$DEFAULT_TARGET"
fi

if [[ ${#PACKAGES[@]} -eq 0 ]]; then
    if [[ "$MODE" == "install" ]]; then
        PACKAGES=("$DEFAULT_PACKAGE")
    else
        echo "Error: Packages are required for uninstall operation. Use -p or --packages to specify packages to uninstall." >&2
        exit 1
    fi
fi

# Validate inputs
if ! command -v stow &> /dev/null; then
    echo "Error: stow command not found. Please install GNU stow." >&2
    exit 1
fi

# Expand ~ to $HOME in target directory
if [[ "$TARGET_DIR" == ~* ]]; then
    TARGET_DIR="${TARGET_DIR/#\~/$HOME}"
fi

# Security validation to prevent directory traversal
case "$TARGET_DIR" in
    */..|*/../|*/../..|*/../../|*\\.\\.|*\\.\\./|*\\.\\./*)
        echo "Error: Invalid target directory - suspected directory traversal attempt." >&2
        exit 1
        ;;
esac

# Additional check after tilde expansion
if [[ "$TARGET_DIR" == *".."* ]]; then
    echo "Error: Invalid target directory - suspected directory traversal attempt." >&2
    exit 1
fi

# Validate source directory exists (script is now inside the claude-skills directory)
SKILLS_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -d "$SKILLS_SOURCE_DIR" ]]; then
    echo "Error: Skills source directory does not exist: $SKILLS_SOURCE_DIR" >&2
    exit 1
fi

# For install mode, validate packages exist in source directory
if [[ "$MODE" == "install" ]]; then
    for pkg in "${PACKAGES[@]}"; do
        if [[ "$pkg" == */* ]]; then
            # Handle packages with slashes - check if the subdirectory exists
            if [[ ! -d "$SKILLS_SOURCE_DIR/$pkg" ]]; then
                echo "Error: Package '$pkg' does not exist in source directory: $SKILLS_SOURCE_DIR" >&2
                exit 1
            fi
        else
            # Handle regular packages - check if the directory exists
            if [[ ! -d "$SKILLS_SOURCE_DIR/$pkg" ]]; then
                echo "Error: Package '$pkg' does not exist in source directory: $SKILLS_SOURCE_DIR" >&2
                exit 1
            fi
        fi
    done

    # Create target directory if it doesn't exist for install
    mkdir -p "$TARGET_DIR"
fi

if [[ "$MODE" == "install" ]]; then
    echo "Installing Claude skills to: $TARGET_DIR"
    echo "Packages to install: ${PACKAGES[*]}"
elif [[ "$MODE" == "uninstall" ]]; then
    echo "Uninstalling Claude skills from: $TARGET_DIR"
    echo "Packages to uninstall: ${PACKAGES[*]}"
fi

# Change to the skills source directory and run stow
cd "$SKILLS_SOURCE_DIR"
for pkg in "${PACKAGES[@]}"; do
    if [[ "$pkg" == */* ]]; then
        # Handle packages with slashes specially - create direct symbolic link
        pkg_dir_name=$(basename "$pkg")
        target_path="$TARGET_DIR/$pkg_dir_name"
        source_path="$SKILLS_SOURCE_DIR/$pkg"

        if [[ "$MODE" == "install" ]]; then
            echo "Installing package with slash: $pkg"
            if [[ -e "$target_path" ]]; then
                echo "Warning: $target_path already exists, skipping..." >&2
            else
                mkdir -p "$(dirname "$target_path")"
                ln -s "$source_path" "$target_path"
                echo "Created symbolic link: $target_path -> $source_path"
            fi
        elif [[ "$MODE" == "uninstall" ]]; then
            echo "Uninstalling package with slash: $pkg"
            if [[ -L "$target_path" ]] && [[ "$(readlink "$target_path")" == "$source_path" ]]; then
                rm "$target_path"
                echo "Removed symbolic link: $target_path"

                # Optionally remove empty parent directories created by us
                rmdir -p "$(dirname "$target_path")" 2>/dev/null || true
            else
                echo "Warning: Expected symbolic link $target_path does not exist or points elsewhere" >&2
            fi
        fi
    else
        # Handle regular packages with stow
        if [[ "$MODE" == "install" ]]; then
            echo "Installing package: $pkg"
            stow -t "$TARGET_DIR" "$pkg"
        elif [[ "$MODE" == "uninstall" ]]; then
            echo "Uninstalling package: $pkg"
            stow -D -t "$TARGET_DIR" "$pkg"
        fi
    fi
done

if [[ "$MODE" == "install" ]]; then
    echo "Installation completed successfully!"
elif [[ "$MODE" == "uninstall" ]]; then
    echo "Uninstallation completed successfully!"
fi