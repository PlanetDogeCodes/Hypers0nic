#!/bin/bash

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/z/my-project}"
BUILD_DIR="${BUILD_DIR:?BUILD_DIR is required}"
PYTHON_VERSION="${PYTHON_VERSION:-3.12}"
NEXT_DIST_DIR="$BUILD_DIR/next-service-dist"
PYTHON_RUNTIME_DIR="$BUILD_DIR/python-runtime"
PYTHON_PACKAGES_DIR="$PYTHON_RUNTIME_DIR/site-packages"

has_python_sources() {
    find "$PROJECT_DIR" \
        \( -type d \( -name '.git' \
        -o -name '.next' \
        -o -name '.venv' \
        -o -name 'node_modules' \
        -o -name '__pycache__' \
        -o -name 'mini-services' \
        -o -name 'upload' \
        -o -name 'download' \
        \) -prune \) \
        -o -type f \( -name '*.py' -o -name '*.pyi' \) -print -quit | grep -q .
}

if ! has_python_sources \
    && [ ! -f "$PROJECT_DIR/requirements.txt" ] \
    && [ ! -f "$PROJECT_DIR/pyproject.toml" ]; then
    echo "ℹ️  Detected Python ，Skipping Python runtime "
    exit 0
fi

if ! command -v uv >/dev/null 2>&1; then
    echo "❌ Detected Python ， uv"
    exit 1
fi

echo "🐍 Detected Python runtime，: $PYTHON_VERSION"
mkdir -p "$NEXT_DIST_DIR" "$PYTHON_PACKAGES_DIR"

install_requirements() {
    local requirements_file="$1"
    local target_dir="${2:-$PYTHON_PACKAGES_DIR}"
    if [ ! -s "$requirements_file" ]; then
        echo "ℹ️  Python ，Skipping"
        return 0
    fi

    echo "📦 Based on $(basename "$requirements_file") finalizing Python production dependencies..."
    uv pip install \
        --python "$PYTHON_VERSION" \
        --target "$target_dir" \
        --requirements "$requirements_file"

    # --target  console scripts  Python  shebang。
    #  Runner  python， start scripts  bin directory PATH。
    if [ -d "$target_dir/bin" ]; then
        for script in "$target_dir"/bin/*; do
            [ -f "$script" ] || continue
            perl -0pi -e 's/\A#![^\n]*python[^\n]*\n/#!\/usr\/bin\/env python\n/' "$script"
        done
    fi
}

install_pyproject() {
    local project_dir="$1"
    local target_dir="$2"
    local output_name="$3"
    local requirements_file="$PYTHON_RUNTIME_DIR/$output_name"

    if [ -f "$project_dir/uv.lock" ]; then
        uv export \
            --project "$project_dir" \
            --frozen \
            --no-dev \
            --no-emit-project \
            --format requirements.txt \
            --output-file "$requirements_file"
    else
        uv pip compile \
            "$project_dir/pyproject.toml" \
            --python-version "$PYTHON_VERSION" \
            --output-file "$requirements_file"
    fi
    install_requirements "$requirements_file" "$target_dir"
}

if [ -f "$PROJECT_DIR/pyproject.toml" ] && [ -f "$PROJECT_DIR/uv.lock" ]; then
    echo "🔒  pyproject.toml + uv.lock ..."
    install_pyproject "$PROJECT_DIR" "$PYTHON_PACKAGES_DIR" "requirements.lock.txt"
elif [ -f "$PROJECT_DIR/requirements.txt" ]; then
    cp "$PROJECT_DIR/requirements.txt" "$PYTHON_RUNTIME_DIR/requirements.txt"
    install_requirements "$PYTHON_RUNTIME_DIR/requirements.txt"
elif [ -f "$PROJECT_DIR/pyproject.toml" ]; then
    echo "📦 pyproject.toml no uv.lock found, resolving production dependencies..."
    install_pyproject "$PROJECT_DIR" "$PYTHON_PACKAGES_DIR" "requirements.txt"
else
    echo "⚠️  Detected Python ， requirements.txt  pyproject.toml； Python "
fi

if has_python_sources; then
    echo "📄 Copying Python sources to deployment project, preserving relative paths..."
    (
        cd "$PROJECT_DIR"
        find . \
            \( -type d \( -name '.git' \
            -o -name '.next' \
            -o -name '.venv' \
            -o -name 'node_modules' \
            -o -name '__pycache__' \
            -o -name 'mini-services' \
            -o -name 'upload' \
            -o -name 'download' \
            \) -prune \) \
            -o -type f \( -name '*.py' -o -name '*.pyi' \) -print0 \
            | tar --null -T - -cf -
    ) | tar -C "$NEXT_DIST_DIR" -xf -
fi

echo "✅ Python runtime finalized in build artifacts"
