# Cache Size Breakdown Action

Reports a clean breakdown of disk usage for one or more directories — useful for understanding what's taking up space in your GitHub Actions cache.

## Usage

```yaml
- name: Show cache size breakdown
  uses: PazerOP/actions/cache-size-breakdown@main
  with:
    paths: |
      ~/.cache/pip
      ~/.npm
      ~/.cargo/registry
```

### Example output

```
Cache Size Breakdown
====================

+---------------------+-----------+
| Path                | Size      |
+---------------------+-----------+
| /home/runner/.cache | 512.00 MB |
|   pip               | 312.50 MB |
|   pre-commit        | 199.50 MB |
| /home/runner/.npm   | 128.00 MB |
+---------------------+-----------+

Total: 640.00 MB
```

## Inputs

| Name    | Required | Default | Description |
|---------|----------|---------|-------------|
| `paths` | yes      |         | Directories to analyze (newline or comma separated) |
| `depth` | no       | `1`     | How many sub-levels to show (0 = top-level only) |

## Outputs

| Name             | Description |
|------------------|-------------|
| `total-bytes`    | Total size in bytes across all paths |
| `size-breakdown` | JSON array of `{ path, bytes, humanSize }` objects |
