#!/bin/bash

# Claude Skills Installation Script
# Install or uninstall Claude skills using stow with customizable target directory and packages

set -euo pipefail

# Color and formatting functions
print_success() {
    echo -e "\033[32m✓\033[0m $1"  # Green checkmark
}

print_error() {
    echo -e "\033[31m✗\033[0m $1" >&2  # Red X
}

print_warning() {
    echo -e "\033[33m⚠\033[0m $1" >&2  # Yellow warning
}

print_info() {
    echo -e "\033[34mℹ\033[0m $1"  # Blue info
}

print_header() {
    echo -e "\033[1;36m=== $1 ===\033[0m"  # Cyan bold header
}

print_subheader() {
    echo -e "\033[1;35m→ $1\033[0m"  # Magenta bold subheader
}

print_package() {
    echo -e "\033[1;33m$1\033[0m"  # Bold yellow for package names
}

SCRIPT_NAME="$(basename "$0")"

# Default values
DEFAULT_PACKAGE="general"
DEFAULT_TARGET="$HOME/.claude/skills"

# Function to display help information
show_help() {
    cat << EOF
\033[1;36mUsage: $SCRIPT_NAME [COMMAND] [OPTIONS]\033[0m

Install or uninstall Claude skills using stow with customizable target directory and packages.
Packages containing slashes (e.g., category/package) are handled with direct symbolic links.

\033[1;35mCOMMANDS:\033[0m
    install              Install packages (default if no command specified)
    uninstall            Uninstall packages

\033[1;35mOPTIONS:\033[0m
    -t, --target PATH     Target directory for stowing skills (default: $DEFAULT_TARGET)
    -p, --packages PKGS   Space-separated list of packages to install/uninstall (default: $DEFAULT_PACKAGE for install)
    -h, --help           Show this help message

\033[1;35mEXAMPLES:\033[0m
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
            print_error "Unknown command: $1"
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
            print_error "Unknown option: $1"
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
        print_error "Packages are required for uninstall operation. Use -p or --packages to specify packages to uninstall."
        exit 1
    fi
fi

# Validate inputs
if ! command -v stow &> /dev/null; then
    print_error "stow command not found. Please install GNU stow."
    exit 1
fi

# Expand ~ to $HOME in target directory
if [[ "$TARGET_DIR" == ~* ]]; then
    TARGET_DIR="${TARGET_DIR/#\~/$HOME}"
fi

# Security validation to prevent directory traversal
case "$TARGET_DIR" in
    */..|*/../|*/../..|*/../../|*\\.\\.|*\\.\\./|*\\.\\./*)
        print_error "Invalid target directory - suspected directory traversal attempt."
        exit 1
        ;;
esac

# Additional check after tilde expansion
if [[ "$TARGET_DIR" == *".."* ]]; then
    print_error "Invalid target directory - suspected directory traversal attempt."
    exit 1
fi

# Validate source directory exists (script is now inside the claude-skills directory)
SKILLS_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -d "$SKILLS_SOURCE_DIR" ]]; then
    print_error "Skills source directory does not exist: $SKILLS_SOURCE_DIR"
    exit 1
fi

# For install mode, validate packages exist in source directory
if [[ "$MODE" == "install" ]]; then
    for pkg in "${PACKAGES[@]}"; do
        if [[ "$pkg" == */* ]]; then
            # Handle packages with slashes - check if the subdirectory exists
            if [[ ! -d "$SKILLS_SOURCE_DIR/$pkg" ]]; then
                print_error "Package '$pkg' does not exist in source directory: $SKILLS_SOURCE_DIR"
                exit 1
            fi
        else
            # Handle regular packages - check if the directory exists
            if [[ ! -d "$SKILLS_SOURCE_DIR/$pkg" ]]; then
                print_error "Package '$pkg' does not exist in source directory: $SKILLS_SOURCE_DIR"
                exit 1
            fi
        fi
    done

    # Create target directory if it doesn't exist for install
    mkdir -p "$TARGET_DIR"
fi

if [[ "$MODE" == "install" ]]; then
    print_header "Installing Claude skills"
    # Print each package with color
    package_list=""
    for pkg in "${PACKAGES[@]}"; do
        if [[ -z "$package_list" ]]; then
            package_list="$(print_package "$pkg")"
        else
            package_list="$package_list $(print_package "$pkg")"
        fi
    done
    print_info "Target directory: $TARGET_DIR"
    print_info "Packages: $package_list"
    echo -e "\033[1;30m─────────────────────────────────────\033[0m"  # Gray separator
elif [[ "$MODE" == "uninstall" ]]; then
    print_header "Uninstalling Claude skills"
    # Print each package with color
    package_list=""
    for pkg in "${PACKAGES[@]}"; do
        if [[ -z "$package_list" ]]; then
            package_list="$(print_package "$pkg")"
        else
            package_list="$package_list $(print_package "$pkg")"
        fi
    done
    print_info "Target directory: $TARGET_DIR"
    print_info "Packages: $package_list"
    echo -e "\033[1;30m─────────────────────────────────────\033[0m"  # Gray separator
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
            print_subheader "Installing package: $(print_package "$pkg")"
            if [[ -e "$target_path" ]]; then
                print_warning "Package $(print_package "$pkg") already installed, skipping..."
            else
                mkdir -p "$(dirname "$target_path")"
                ln -s "$source_path" "$target_path"
                print_success "Success"
            fi
        elif [[ "$MODE" == "uninstall" ]]; then
            print_subheader "Uninstalling package: $(print_package "$pkg")"
            if [[ -L "$target_path" ]] && [[ "$(readlink "$target_path")" == "$source_path" ]]; then
                rm "$target_path"
                print_success "Success"

                # Optionally remove empty parent directories created by us
                rmdir -p "$(dirname "$target_path")" 2>/dev/null || true
            else
                print_warning "Package $(print_package "$pkg") not installed, skipping..."
            fi
        fi
    else
        # Handle regular packages with stow
        if [[ "$MODE" == "install" ]]; then
            print_subheader "Installing package: $(print_package "$pkg")"
            # With stow, we need to check if any of the package contents already exist in target
            # We'll check the first level of items in the package directory to see if they exist in target
            pkg_items=()
            while IFS= read -r -d '' item; do
                pkg_items+=("$(basename "$item")")
            done < <(find "$SKILLS_SOURCE_DIR/$pkg" -mindepth 1 -maxdepth 1 -print0 2>/dev/null)

            already_installed=false
            for item in "${pkg_items[@]}"; do
                if [[ -e "$TARGET_DIR/$item" ]]; then
                    already_installed=true
                    break
                fi
            done

            if [[ "$already_installed" == true ]]; then
                print_warning "Package $(print_package "$pkg") already installed, skipping..."
            else
                stow -t "$TARGET_DIR" "$pkg"
                print_success "Success"
            fi
        elif [[ "$MODE" == "uninstall" ]]; then
            print_subheader "Uninstalling package: $(print_package "$pkg")"
            # Similarly, check if package items exist in target to determine if package is installed
            pkg_items=()
            while IFS= read -r -d '' item; do
                pkg_items+=("$(basename "$item")")
            done < <(find "$SKILLS_SOURCE_DIR/$pkg" -mindepth 1 -maxdepth 1 -print0 2>/dev/null)

            any_exists=false
            for item in "${pkg_items[@]}"; do
                if [[ -e "$TARGET_DIR/$item" ]]; then
                    any_exists=true
                    break
                fi
            done

            if [[ "$any_exists" == false ]]; then
                print_warning "Package $(print_package "$pkg") not installed, skipping..."
            else
                stow -D -t "$TARGET_DIR" "$pkg"
                print_success "Success"
            fi
        fi
    fi
done

if [[ "$MODE" == "install" ]]; then
    echo -e "\033[1;30m─────────────────────────────────────\033[0m"  # Gray separator
    print_success "Installation completed successfully!"
elif [[ "$MODE" == "uninstall" ]]; then
    echo -e "\033[1;30m─────────────────────────────────────\033[0m"  # Gray separator
    print_success "Uninstallation completed successfully!"
fi