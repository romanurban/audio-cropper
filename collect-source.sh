#!/bin/bash

# Script to collect source code files and copy to clipboard
# Usage: ./collect-source.sh file1.js file2.css file3.html

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file1> <file2> ... <fileN>"
    echo "Example: $0 js/main.js styles.css index.html"
    exit 1
fi

# Temporary file to store the output
temp_file=$(mktemp)

# Process each file
for file in "$@"; do
    if [ -f "$file" ]; then
        echo "$file:" >> "$temp_file"
        cat "$file" >> "$temp_file"
        echo "" >> "$temp_file"
        echo "###" >> "$temp_file"
        echo "" >> "$temp_file"
    else
        echo "Warning: File '$file' not found" >&2
    fi
done

# Copy to clipboard based on OS
if command -v pbcopy > /dev/null 2>&1; then
    # macOS
    cat "$temp_file" | pbcopy
    echo "Source code copied to clipboard (macOS)"
elif command -v xclip > /dev/null 2>&1; then
    # Linux with xclip
    cat "$temp_file" | xclip -selection clipboard
    echo "Source code copied to clipboard (Linux - xclip)"
elif command -v xsel > /dev/null 2>&1; then
    # Linux with xsel
    cat "$temp_file" | xsel --clipboard --input
    echo "Source code copied to clipboard (Linux - xsel)"
else
    # Fallback - just display the content
    echo "No clipboard utility found. Here's the content:"
    echo "=============================================="
    cat "$temp_file"
fi

# Clean up
rm "$temp_file"

echo "Processed $# files"