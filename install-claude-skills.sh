#!/bin/bash

# Claude Skills Installation Script
# Install Claude skills using stow with customizable target directory and packages

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

# Default values
DEFAULT_PACKAGE="general"
DEFAULT_TARGET="$HOME/.claude/skills"

# Function to display help information
show_help() {
    cat << EOF
Usage: $SCRIPT_NAME [OPTIONS]

Install Claude skills using stow with customizable target directory and packages.

OPTIONS:
    -t, --target PATH     Target directory for stowing skills (default: $DEFAULT_TARGET)
    -p, --packages PKGS   Space-separated list of packages to install (default: $DEFAULT_PACKAGE)
    -h, --help           Show this help message

EXAMPLES:
    $SCRIPT_NAME                                    # Install 'general' package to ~/.claude/skills
    $SCRIPT_NAME -t /custom/path                    # Install 'general' package to /custom/path
    $SCRIPT_NAME -p package1 package2               # Install multiple packages to default location
    $SCRIPT_NAME -t /custom/path -p pkg1 pkg2       # Install multiple packages to custom location
EOF
}

# Initialize variables
TARGET_DIR=""
PACKAGES=()

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
    PACKAGES=("$DEFAULT_PACKAGE")
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

# Validate source directory exists
SKILLS_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/claude-skills"
if [[ ! -d "$SKILLS_SOURCE_DIR" ]]; then
    echo "Error: Skills source directory does not exist: $SKILLS_SOURCE_DIR" >&2
    exit 1
fi

# Validate packages exist in source directory
for pkg in "${PACKAGES[@]}"; do
    if [[ ! -d "$SKILLS_SOURCE_DIR/$pkg" ]]; then
        echo "Error: Package '$pkg' does not exist in source directory: $SKILLS_SOURCE_DIR" >&2
        exit 1
    fi
done

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

echo "Installing Claude skills to: $TARGET_DIR"
echo "Packages to install: ${PACKAGES[*]}"

# Change to the skills source directory and run stow
cd "$SKILLS_SOURCE_DIR"
for pkg in "${PACKAGES[@]}"; do
    echo "Installing package: $pkg"
    stow -t "$TARGET_DIR" "$pkg"
done

echo "Installation completed successfully!"