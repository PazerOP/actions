# Tab Indentation Check Action

A GitHub Action that enforces consistent indentation (tabs or spaces) in your code files. This action helps maintain code consistency and enables user-customizable display width when using tabs.

## Features

- Enforces either tab or space indentation
- Configurable file patterns (include/exclude)
- GitHub annotations for inline violation display in PR diffs
- Detailed console output with visible whitespace indicators
- Configurable violation limits per file
- Option to ignore blank lines and multi-line comments

## Usage

### Basic Usage (tabs, default patterns)

```yaml
- uses: PazerOP/actions/tab-check-action@v1
```

### Custom File Types

```yaml
- uses: PazerOP/actions/tab-check-action@v1
  with:
    include: |
      **/*.ts
      **/*.tsx
      **/*.go
      **/*.rs
```

### Enforce Spaces Instead

```yaml
- uses: PazerOP/actions/tab-check-action@v1
  with:
    style: spaces
```

### Check Specific Directory Without Failing

```yaml
- uses: PazerOP/actions/tab-check-action@v1
  with:
    path: ./src
    fail-on-violation: false
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Directory to check | `.` |
| `include` | Glob patterns for files to include (newline or comma separated) | See below |
| `exclude` | Glob patterns for files to exclude (newline or comma separated) | See below |
| `style` | Required indentation style: `tabs` or `spaces` | `tabs` |
| `ignore-blank-lines` | Ignore lines that are only whitespace | `true` |
| `ignore-comments` | Ignore indentation inside multi-line comments | `false` |
| `fail-on-violation` | Fail the action if violations are found | `true` |
| `max-violations-per-file` | Max violations to report per file (0 = unlimited) | `5` |

### Default Include Patterns

```
**/*.ts
**/*.js
**/*.tsx
**/*.jsx
**/*.sh
**/*.bats
**/*.yml
**/*.yaml
```

### Default Exclude Patterns

```
**/node_modules/**
**/dist/**
**/build/**
**/.git/**
**/vendor/**
**/*.min.js
**/*.min.css
**/package-lock.json
**/yarn.lock
**/pnpm-lock.yaml
```

## Outputs

| Output | Description |
|--------|-------------|
| `total-files-checked` | Number of files checked |
| `files-with-violations` | Number of files with violations |
| `total-violations` | Total number of violating lines |
| `violation-list` | JSON array of violation objects |

## Development

### Prerequisites

- Node.js 20+
- npm

### Building

```bash
cd tab-check-action
npm install
npm run build
```

### Testing Locally

You can test the action locally using [act](https://github.com/nektos/act):

```bash
act -j check-indentation
```

## License

MIT
