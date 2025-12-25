# Setup Buildcache

GitHub Action to install and configure [buildcache](https://github.com/mbitsnbites/buildcache) for faster C/C++ builds.

## Usage

```yaml
- uses: PazerOP/actions/setup-buildcache@v1
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | Buildcache version to install | `v0.31.5` |
| `cache-key` | Additional cache key suffix (OS is auto-detected) | `''` |
| `cache-scope` | Cache scope: `repo`, `branch`, or `commit` | `repo` |
| `max-cache-size` | Maximum cache size in bytes | `2147483648` (2GB) |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | Whether the build cache was restored |
| `binary-cache-hit` | Whether the buildcache binary was restored |

## Cache Scope

- `repo` - Cache shared across all branches (default)
- `branch` - Separate cache per branch
- `commit` - Separate cache per commit

## Example

```yaml
jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: PazerOP/actions/setup-buildcache@v1
      - run: cmake -B build
      - run: cmake --build build
```

## How It Works

1. Downloads and caches the buildcache binary (per OS/version)
2. On Linux, installs libssl1.1 for compatibility
3. Restores any existing build cache
4. Adds buildcache to PATH and sets `BUILDCACHE_DIR`
5. After the job, saves the build cache
