# Release Notes Template

This template is used to structure release notes in a consistent format.

## Format

### ✨ What's Changed

Changes are automatically categorized by commit prefix:

- **feat:** or **feature:** → 🚀 Features
- **fix:** or **bugfix:** → 🐛 Bug Fixes  
- **docs:** or **doc:** → 📝 Documentation
- **refactor:**, **perf:**, **style:** → ♻️ Code Refactoring
- Others → 📦 Other Changes

### 🚀 Downloads

Platform-specific download links for:
- CLI binaries (macOS, Linux, Windows)
- Browser extensions (Chrome, Firefox)

### 📦 Installation

Quick installation instructions

## Commit Message Guidelines

For better changelog generation, follow Conventional Commits:

```
<type>: <description>

[optional body]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `style`: Code style changes
- `test`: Test changes
- `chore`: Build/tooling changes
- `release`: Version releases

**Examples:**
```
feat: add TOTP generation support
fix: resolve login form detection issue
docs: update installation guide
refactor: optimize encryption performance
```
