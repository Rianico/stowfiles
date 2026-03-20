#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "lzstring>=1.0.4",
# ]
# ///
"""
Excalidraw Compressor for Obsidian Markdown Files

Converts standard JSON blocks to compressed-json format to reduce file size.

Usage:
    uv run excalidraw-compressor.py <file.md> [--dry-run]
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import lzstring
except ImportError:
    lzstring = None


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


def is_valid_id(id_str: str) -> bool:
    """Check if ID is exactly 8 alphanumeric characters."""
    return bool(re.match(r"^[a-zA-Z0-9]{8}$", id_str))


def validate_json_elements(json_data: Dict[str, Any]) -> List[str]:
    """
    Validate JSON elements and return list of issues.
    """
    issues = []
    elements = json_data.get("elements", [])

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

    return issues


def validate_file(file_path: str) -> Tuple[bool, List[str]]:
    """
    Validate an Excalidraw markdown file before compressing.
    Returns (is_valid, list_of_issues).
    """
    issues = []

    try:
        content = Path(file_path).read_text()
    except Exception as e:
        return False, [f"Error reading file: {e}"]

    # Extract and validate JSON blocks
    json_blocks = extract_json_blocks(content)

    if not json_blocks:
        issues.append("No JSON blocks found in file")
        return False, issues

    for block_type, start_line, end_line, block_content in json_blocks:
        if block_type == "compressed-json":
            # Already compressed, skip validation for compression
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

    return len(issues) == 0, issues


def compress_file(file_path: str, dry_run: bool = False) -> Tuple[bool, List[str]]:
    """
    Compress all standard JSON blocks in an Excalidraw markdown file.
    Returns (success, list_of_changes).
    """
    changes = []

    try:
        content = Path(file_path).read_text()
    except Exception as e:
        return False, [f"Error reading file: {e}"]

    # Validate first
    is_valid, validation_issues = validate_file(file_path)
    if not is_valid:
        return False, [f"Validation failed: {issue}" for issue in validation_issues]

    # Extract JSON blocks
    json_blocks = extract_json_blocks(content)

    # Find uncompressed JSON blocks
    uncompressed_blocks = [
        (block_type, start_line, end_line, block_content)
        for block_type, start_line, end_line, block_content in json_blocks
        if block_type == "json"
    ]

    if not uncompressed_blocks:
        return True, ["No uncompressed JSON blocks found"]

    # Process each uncompressed block
    lines = content.split("\n")
    output_lines = []
    line_idx = 0

    for block_type, start_line, end_line, block_content in json_blocks:
        # Add lines before this block
        while line_idx < start_line - 1:
            output_lines.append(lines[line_idx])
            line_idx += 1

        if block_type == "json":
            # Compress this block
            try:
                json_data = json.loads(block_content)
                compressed = compress_json(json_data)

                if compressed:
                    # Replace with compressed-json block
                    output_lines.append("```compressed-json")
                    output_lines.append(compressed)
                    output_lines.append("```")

                    # Calculate size reduction
                    original_size = len(block_content)
                    compressed_size = len(compressed)
                    reduction = ((original_size - compressed_size) / original_size) * 100

                    changes.append(
                        f"Line {start_line}: Compressed JSON block ({original_size} -> {compressed_size} bytes, {reduction:.1f}% reduction)"
                    )
                else:
                    # Keep original if compression fails
                    output_lines.append("```json")
                    output_lines.append(block_content)
                    output_lines.append("```")
                    changes.append(
                        f"Line {start_line}: Failed to compress, kept as-is"
                    )
            except json.JSONDecodeError as e:
                # Keep original if JSON is invalid
                output_lines.append("```json")
                output_lines.append(block_content)
                output_lines.append("```")
                changes.append(f"Line {start_line}: Invalid JSON, kept as-is")
        else:
            # Already compressed-json or other block type, keep as-is
            output_lines.append(f"```{block_type}")
            output_lines.append(block_content)
            output_lines.append("```")

        # Skip past the block content and closing backtick
        line_idx = end_line

    # Add remaining lines after last block
    while line_idx < len(lines):
        output_lines.append(lines[line_idx])
        line_idx += 1

    if not dry_run:
        # Write compressed content
        fixed_content = "\n".join(output_lines)
        try:
            Path(file_path).write_text(fixed_content)
        except Exception as e:
            return False, [f"Error writing file: {e}"]

    return True, changes


def main():
    parser = argparse.ArgumentParser(
        description="Excalidraw Compressor for Obsidian Markdown Files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    uv run excalidraw-compressor.py file.md
    uv run excalidraw-compressor.py file.md --dry-run
        """,
    )
    parser.add_argument("file", help="Path to the markdown file to compress")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be compressed without modifying the file",
    )

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    # Compress the file
    success, results = compress_file(args.file, args.dry_run)

    if success:
        if args.dry_run:
            print(f"Dry run - would make {len(results)} change(s) in {file_path.name}:")
        else:
            if "No uncompressed JSON blocks found" in results:
                print(f"✓ {file_path.name} has no uncompressed JSON blocks")
                sys.exit(0)
            print(f"Compressed {len(results)} block(s) in {file_path.name}:")

        for result in results:
            print(f"  - {result}")

        # Show total size reduction if not dry run
        if not args.dry_run and success and "No uncompressed" not in str(results):
            total_reduction = 0
            for r in results:
                if "reduction" in r:
                    try:
                        # Extract percentage from format: "(X -> Y bytes, Z% reduction)"
                        pct_str = r.split(",")[1].strip().replace("% reduction", "")
                        total_reduction += float(pct_str)
                    except (IndexError, ValueError):
                        pass
            if total_reduction > 0:
                print(f"\nTotal size reduction: ~{total_reduction:.1f}%")

        sys.exit(0)
    else:
        print(f"✗ Failed to compress {file_path.name}:")
        for result in results:
            print(f"  - {result}")
        sys.exit(1)


if __name__ == "__main__":
    main()
