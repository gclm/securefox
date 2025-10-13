#!/bin/bash
set -e

# Generate CHANGELOG.md from git history
# Usage: ./scripts/generate-changelog.sh [version]

VERSION=${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo "unreleased")}
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || git rev-list --max-parents=0 HEAD)

echo "Generating changelog for $VERSION (from $PREV_TAG)"

CHANGELOG_FILE="CHANGELOG.md"
TEMP_FILE="CHANGELOG.tmp"

# Header
cat > "$TEMP_FILE" << EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

EOF

# Function to generate section for a version
generate_section() {
    local tag=$1
    local prev=$2
    local date=$(git log -1 --format=%ai "$tag" 2>/dev/null | cut -d' ' -f1 || date +%Y-%m-%d)
    
    echo "## [$tag] - $date" >> "$TEMP_FILE"
    echo "" >> "$TEMP_FILE"
    
    # Get commits between tags
    local commits=$(git log "$prev..$tag" --pretty=format:"%s" --no-merges 2>/dev/null || echo "")
    
    if [ -z "$commits" ]; then
        echo "No changes recorded." >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        return
    fi
    
    # Features
    local features=$(echo "$commits" | grep -E "^feat:|^feature:" | sed 's/^feat: /- /' | sed 's/^feature: /- /' || true)
    if [ ! -z "$features" ]; then
        echo "### Added" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "$features" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
    fi
    
    # Bug fixes
    local fixes=$(echo "$commits" | grep -E "^fix:|^bugfix:" | sed 's/^fix: /- /' | sed 's/^bugfix: /- /' || true)
    if [ ! -z "$fixes" ]; then
        echo "### Fixed" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "$fixes" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
    fi
    
    # Documentation
    local docs=$(echo "$commits" | grep -E "^docs:|^doc:" | sed 's/^docs: /- /' | sed 's/^doc: /- /' || true)
    if [ ! -z "$docs" ]; then
        echo "### Documentation" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "$docs" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
    fi
    
    # Refactoring
    local refactor=$(echo "$commits" | grep -E "^refactor:|^perf:|^style:" | sed 's/^refactor: /- /' | sed 's/^perf: /- /' | sed 's/^style: /- /' || true)
    if [ ! -z "$refactor" ]; then
        echo "### Changed" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
        echo "$refactor" >> "$TEMP_FILE"
        echo "" >> "$TEMP_FILE"
    fi
}

# Generate sections for all tags
TAGS=$(git tag --sort=-v:refname)
PREV_TAG=""

for tag in $TAGS; do
    if [ -z "$PREV_TAG" ]; then
        PREV_TAG=$(git rev-list --max-parents=0 HEAD)
    fi
    generate_section "$tag" "$PREV_TAG"
    PREV_TAG=$tag
done

# Move temp file to CHANGELOG.md
mv "$TEMP_FILE" "$CHANGELOG_FILE"

echo "✅ Changelog generated successfully: $CHANGELOG_FILE"
