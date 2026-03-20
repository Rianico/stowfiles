#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "lzstring>=1.0.4",
# ]
# ///
"""
Excalidraw Validator for Obsidian Markdown Files

Usage:
    uv run excalidraw-validator.py <file.md> [--check|--fix]
"""

import argparse
import json
import random
import re
import string
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import lzstring
except ImportError:
    lzstring = None


def generate_id() -> str:
    """Generate a random 8-character alphanumeric ID."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=8))


def is_valid_id(id_str: str) -> bool:
    """Check if ID is exactly 8 alphanumeric characters."""
    return bool(re.match(r"^[a-zA-Z0-9]{8}$", id_str))


def decompress_json(compressed_data: str) -> Optional[Dict[str, Any]]:
    """Decompress lz-string compressed data."""
    if lzstring is None:
        print(
            "Error: lz-string-python not installed. Run: pip install lz-string-python",
            file=sys.stderr,
        )
        return None

    try:
        # For compressed-json, the data may span multiple lines - join them
        # Remove any whitespace/newlines to get continuous base64 string
        continuous_data = "".join(compressed_data.split())
        decompressed = lzstring.LZString.decompressFromBase64(continuous_data)
        if decompressed:
            return json.loads(decompressed)
    except Exception as e:
        print(f"Error decompressing data: {e}", file=sys.stderr)
    return None


def compress_json(data: Dict[str, Any]) -> Optional[str]:
    """Compress JSON data using lz-string."""
    if lzstring is None:
        print(
            "Error: lz-string-python not installed. Run: pip install lz-string-python",
            file=sys.stderr,
        )
        return None

    try:
        json_str = json.dumps(data, separators=(",", ":"))
        return lzstring.LZString.compressToBase64(json_str)
    except Exception as e:
        print(f"Error compressing data: {e}", file=sys.stderr)
    return None


def extract_text_element_ids(content: str) -> List[Tuple[str, int, str]]:
    """
    Extract text element IDs from markdown content.
    Returns list of (id, line_number, full_line) tuples.
    """
    results = []
    lines = content.split("\n")

    in_text_elements = False
    for i, line in enumerate(lines, 1):
        if line.strip() == "## Text Elements":
            in_text_elements = True
            continue

        if in_text_elements:
            # Stop at section boundaries
            if line.strip().startswith("## ") and line.strip() != "## Text Elements":
                break
            if line.strip() == "%%":
                break

            # Match pattern: ^something at end of line (capture everything after ^)
            match = re.search(r"\^([^\s]+)\s*$", line)
            if match:
                results.append((match.group(1), i, line))

    return results


def extract_json_blocks(content: str) -> List[Tuple[str, int, int, str]]:
    """
    Extract JSON blocks from markdown.
    Returns list of (block_type, start_line, end_line, block_content) tuples.
    block_type is either 'json' or 'compressed-json'.
    """
    results = []
    lines = content.split("\n")

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check for ```json or ```compressed-json
        json_match = re.match(r"^```(json|compressed-json)$", line.strip())
        if json_match:
            block_type = json_match.group(1)
            start_line = i + 1
            block_content = []
            i += 1

            # Find closing ```
            while i < len(lines):
                # Skip duplicate opening backticks (malformed files)
                if re.match(r"^```(json|compressed-json)$", lines[i].strip()):
                    i += 1
                    continue
                if lines[i].strip() == "```":
                    end_line = i + 1
                    results.append(
                        (block_type, start_line, end_line, "\n".join(block_content))
                    )
                    break
                block_content.append(lines[i])
                i += 1
        i += 1

    return results


def extract_element_links_section(content: str) -> Optional[Tuple[int, int, str]]:
    """
    Extract ## Element Links section if present.
    Returns (start_line, end_line, section_content) or None.
    """
    lines = content.split("\n")

    start_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "## Element Links":
            start_idx = i
            break

    if start_idx is None:
        return None

    # Find end of section (next ## or end of file)
    end_idx = len(lines)
    for i in range(start_idx + 1, len(lines)):
        if lines[i].strip().startswith("## "):
            end_idx = i
            break

    section_content = "\n".join(lines[start_idx:end_idx])
    return (start_idx + 1, end_idx, section_content)


def validate_json_elements(json_data: Dict[str, Any]) -> List[str]:
    """
    Validate JSON elements and return list of issues.
    """
    issues = []
    elements = json_data.get("elements", [])

    # First pass: collect all valid element IDs
    valid_element_ids = set()
    for elem in elements:
        elem_id = elem.get("id")
        if elem_id and is_valid_id(elem_id):
            valid_element_ids.add(elem_id)

    # Second pass: validate all elements
    for elem in elements:
        elem_id = elem.get("id")
        elem_type = elem.get("type")

        # Validate element ID
        if not elem_id:
            issues.append("Element missing 'id' field")
        elif not is_valid_id(elem_id):
            issues.append(
                f"Invalid element ID: '{elem_id}' (must be 8 alphanumeric chars)"
            )

        # Validate link field is null
        if elem.get("link") is not None:
            issues.append(
                f"Element {elem_id} has non-null 'link' field: {elem.get('link')}"
            )

        # Validate boundElements references
        for bound in elem.get("boundElements", []):
            bound_id = bound.get("id")
            if bound_id and not is_valid_id(bound_id):
                issues.append(
                    f"Element {elem_id} has invalid boundElements ID: '{bound_id}'"
                )

        # Validate containerId
        container_id = elem.get("containerId")
        if container_id is not None and not is_valid_id(container_id):
            issues.append(
                f"Element {elem_id} has invalid containerId: '{container_id}'"
            )

        # Validate startBinding
        start_binding = elem.get("startBinding")
        if start_binding:
            binding_elem_id = start_binding.get("elementId")
            if binding_elem_id and not is_valid_id(binding_elem_id):
                issues.append(
                    f"Element {elem_id} has invalid startBinding elementId: '{binding_elem_id}'"
                )

        # Validate endBinding
        end_binding = elem.get("endBinding")
        if end_binding:
            binding_elem_id = end_binding.get("elementId")
            if binding_elem_id and not is_valid_id(binding_elem_id):
                issues.append(
                    f"Element {elem_id} has invalid endBinding elementId: '{binding_elem_id}'"
                )

    return issues


def fix_json_elements(json_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Fix all JSON elements and return (fixed_data, list_of_changes).
    """
    changes = []
    elements = json_data.get("elements", [])

    # Build mapping of old IDs to new IDs
    id_mapping: Dict[str, str] = {}

    # First pass: identify and fix invalid element IDs
    for elem in elements:
        elem_id = elem.get("id")
        if elem_id and not is_valid_id(elem_id):
            new_id = generate_id()
            id_mapping[elem_id] = new_id
            elem["id"] = new_id
            changes.append(f"Renamed element ID '{elem_id}' -> '{new_id}'")
        elif not elem_id:
            new_id = generate_id()
            elem["id"] = new_id
            changes.append(f"Added missing element ID: '{new_id}'")

    # Second pass: fix references and other fields
    for elem in elements:
        elem_id = elem.get("id", "unknown")

        # Set link to null
        if elem.get("link") is not None:
            changes.append(f"Element {elem_id}: set 'link' to null")
            elem["link"] = None

        # Fix boundElements references
        for bound in elem.get("boundElements", []):
            bound_id = bound.get("id")
            if bound_id in id_mapping:
                new_id = id_mapping[bound_id]
                bound["id"] = new_id
                changes.append(
                    f"Element {elem_id}: updated boundElements reference '{bound_id}' -> '{new_id}'"
                )

        # Fix containerId
        container_id = elem.get("containerId")
        if container_id in id_mapping:
            new_id = id_mapping[container_id]
            elem["containerId"] = new_id
            changes.append(
                f"Element {elem_id}: updated containerId '{container_id}' -> '{new_id}'"
            )

        # Fix startBinding
        start_binding = elem.get("startBinding")
        if start_binding:
            binding_elem_id = start_binding.get("elementId")
            if binding_elem_id in id_mapping:
                new_id = id_mapping[binding_elem_id]
                start_binding["elementId"] = new_id
                changes.append(
                    f"Element {elem_id}: updated startBinding elementId '{binding_elem_id}' -> '{new_id}'"
                )

        # Fix endBinding
        end_binding = elem.get("endBinding")
        if end_binding:
            binding_elem_id = end_binding.get("elementId")
            if binding_elem_id in id_mapping:
                new_id = id_mapping[binding_elem_id]
                end_binding["elementId"] = new_id
                changes.append(
                    f"Element {elem_id}: updated endBinding elementId '{binding_elem_id}' -> '{new_id}'"
                )

    return json_data, changes


def fix_text_element_ids(
    content: str, json_data: Optional[Dict[str, Any]] = None
) -> Tuple[str, List[str]]:
    """
    Fix invalid text element IDs in markdown content.
    Returns (fixed_content, list_of_changes).
    """
    changes = []
    lines = content.split("\n")

    # Build ID mapping for text elements
    id_mapping: Dict[str, str] = {}

    in_text_elements = False
    for i, line in enumerate(lines):
        if line.strip() == "## Text Elements":
            in_text_elements = True
            continue

        if in_text_elements:
            if line.strip().startswith("## ") and line.strip() != "## Text Elements":
                break
            if line.strip() == "%%":
                break

            # Check for invalid ID - match ^ followed by any non-whitespace at end of line
            match = re.search(r"\^([^\s]+)\s*$", line)
            if match:
                old_id = match.group(1)
                if not is_valid_id(old_id):
                    new_id = generate_id()
                    id_mapping[old_id] = new_id
                    # Replace the entire ^old_id with ^new_id
                    new_line = re.sub(r"\^[^\s]+\s*$", f"^{new_id}", line)
                    lines[i] = new_line
                    changes.append(f"Renamed text element ID '{old_id}' -> '{new_id}'")

    # If json_data provided, also update text element IDs in JSON
    if json_data and id_mapping:
        elements = json_data.get("elements", [])
        for elem in elements:
            elem_type = elem.get("type")
            if elem_type == "text":
                elem_id = elem.get("id")
                if elem_id in id_mapping:
                    new_id = id_mapping[elem_id]
                    elem["id"] = new_id
                    changes.append(
                        f"Updated JSON text element ID '{elem_id}' -> '{new_id}'"
                    )

                # Update boundElements references in shapes
                for bound in elem.get("boundElements", []):
                    bound_id = bound.get("id")
                    if bound_id in id_mapping:
                        bound["id"] = id_mapping[bound_id]

    return "\n".join(lines), changes


def remove_element_links_section(content: str) -> Tuple[str, Optional[str]]:
    """
    Remove ## Element Links section from content.
    Returns (fixed_content, removed_section or None).
    """
    lines = content.split("\n")

    start_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "## Element Links":
            start_idx = i
            break

    if start_idx is None:
        return content, None

    # Find end of section
    end_idx = len(lines)
    for i in range(start_idx + 1, len(lines)):
        if lines[i].strip().startswith("## "):
            end_idx = i
            break

    removed = "\n".join(lines[start_idx:end_idx])
    new_lines = lines[:start_idx] + lines[end_idx:]

    return "\n".join(new_lines), removed


def validate_file(file_path: str) -> Tuple[bool, List[str]]:
    """
    Validate an Excalidraw markdown file.
    Returns (is_valid, list_of_issues).
    """
    issues = []

    try:
        content = Path(file_path).read_text()
    except Exception as e:
        return False, [f"Error reading file: {e}"]

    # Check for ## Element Links section
    links_section = extract_element_links_section(content)
    if links_section:
        issues.append(
            f"## Element Links section found at line {links_section[0]} (must be removed)"
        )

    # Extract and validate JSON blocks
    json_blocks = extract_json_blocks(content)

    if not json_blocks:
        issues.append("No JSON blocks found in file")
        return False, issues

    for block_type, start_line, end_line, block_content in json_blocks:
        if block_type == "compressed-json":
            if lzstring is None:
                issues.append(
                    f"Line {start_line}: compressed-json block found but lz-string-python not installed"
                )
                continue

            json_data = decompress_json(block_content)
            if json_data is None:
                issues.append(
                    f"Line {start_line}: Failed to decompress compressed-json block"
                )
                continue
        else:
            try:
                json_data = json.loads(block_content)
            except json.JSONDecodeError as e:
                issues.append(f"Line {start_line}: Invalid JSON syntax: {e}")
                continue

        # Validate JSON elements
        json_issues = validate_json_elements(json_data)
        for issue in json_issues:
            issues.append(f"Line {start_line}: {issue}")

    # Extract and validate text element IDs
    text_ids = extract_text_element_ids(content)
    for id_str, line_num, line in text_ids:
        if not is_valid_id(id_str):
            issues.append(
                f"Line {line_num}: Invalid text element ID '^{id_str}' (must be 8 alphanumeric chars)"
            )

    return len(issues) == 0, issues


def fix_file(file_path: str) -> Tuple[bool, List[str]]:
    """
    Fix all issues in an Excalidraw markdown file.
    Returns (success, list_of_changes).
    """
    changes = []

    try:
        content = Path(file_path).read_text()
    except Exception as e:
        return False, [f"Error reading file: {e}"]

    # Remove ## Element Links section
    content, removed = remove_element_links_section(content)
    if removed:
        changes.append("Removed ## Element Links section")

    # Fix text element IDs first (before processing JSON)
    content, text_changes = fix_text_element_ids(content)
    changes.extend(text_changes)

    # Extract and fix JSON blocks
    json_blocks = extract_json_blocks(content)

    if not json_blocks:
        return False, ["No JSON blocks found in file"]

    # Process each JSON block - rebuild content with fixed blocks
    lines = content.split("\n")
    output_lines = []
    line_idx = 0

    for block_type, start_line, end_line, block_content in json_blocks:
        # Add lines before this block
        while line_idx < start_line - 1:
            output_lines.append(lines[line_idx])
            line_idx += 1

        # Add opening backtick
        output_lines.append(f"```{block_type}")

        if block_type == "compressed-json":
            if lzstring is None:
                changes.append(
                    f"Line {start_line}: Cannot fix compressed-json without lz-string-python"
                )
                # Keep original content
                while line_idx < end_line:
                    output_lines.append(lines[line_idx])
                    line_idx += 1
                output_lines.append("```")
                line_idx += 1
                continue

            json_data = decompress_json(block_content)
            if json_data is None:
                changes.append(
                    f"Line {start_line}: Failed to decompress compressed-json block"
                )
                # Keep original content
                while line_idx < end_line:
                    output_lines.append(lines[line_idx])
                    line_idx += 1
                output_lines.append("```")
                line_idx += 1
                continue

            # Fix JSON elements
            json_data, json_changes = fix_json_elements(json_data)
            changes.extend([f"Line {start_line}: {c}" for c in json_changes])

            # Recompress and add to output
            new_compressed = compress_json(json_data)
            if new_compressed:
                output_lines.append(new_compressed)
            else:
                # Keep original if compression fails
                output_lines.append(block_content)
        else:
            try:
                json_data = json.loads(block_content)
            except json.JSONDecodeError as e:
                changes.append(
                    f"Line {start_line}: Invalid JSON syntax (cannot fix): {e}"
                )
                # Keep original content
                while line_idx < end_line:
                    output_lines.append(lines[line_idx])
                    line_idx += 1
                output_lines.append("```")
                line_idx += 1
                continue

            # Fix JSON elements
            json_data, json_changes = fix_json_elements(json_data)
            changes.extend([f"Line {start_line}: {c}" for c in json_changes])

            # Add fixed JSON
            new_block = json.dumps(json_data, indent=2)
            output_lines.append(new_block)

        # Skip past the block content and closing backtick
        line_idx = end_line
        output_lines.append("```")

    # Add remaining lines after last block
    while line_idx < len(lines):
        output_lines.append(lines[line_idx])
        line_idx += 1

    # Write fixed content
    fixed_content = "\n".join(output_lines)
    try:
        Path(file_path).write_text(fixed_content)
    except Exception as e:
        return False, [f"Error writing file: {e}"]

    return True, changes


def main():
    parser = argparse.ArgumentParser(
        description="Excalidraw Validator for Obsidian Markdown Files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    uv run excalidraw-validator.py file.md --check
    uv run excalidraw-validator.py file.md --fix
        """,
    )
    parser.add_argument("file", help="Path to the markdown file to validate/fix")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check file for issues (exit 0 if valid, 1 if issues found)",
    )
    parser.add_argument("--fix", action="store_true", help="Fix all issues in the file")

    args = parser.parse_args()

    if not args.check and not args.fix:
        parser.print_help()
        sys.exit(1)

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    if args.check:
        is_valid, issues = validate_file(args.file)
        if is_valid:
            print(f"✓ {file_path.name} is valid")
            sys.exit(0)
        else:
            print(f"✗ {file_path.name} has {len(issues)} issue(s):")
            for issue in issues:
                print(f"  - {issue}")
            sys.exit(1)

    elif args.fix:
        success, changes = fix_file(args.file)
        if success:
            if changes:
                print(f"Fixed {len(changes)} issue(s) in {file_path.name}:")
                for change in changes:
                    print(f"  - {change}")
            else:
                print(f"✓ {file_path.name} has no issues to fix")
            sys.exit(0)
        else:
            print(f"✗ Failed to fix {file_path.name}:")
            for change in changes:
                print(f"  - {change}")
            sys.exit(1)


if __name__ == "__main__":
    main()
