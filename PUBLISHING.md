# Publishing to npm and Yarn

This document outlines the steps required to publish the `socketnest-js` library to npm.

## Prerequisites

1. Make sure you have an npm account:
   - Create one at [npmjs.com](https://www.npmjs.com/signup) if you don't have one.
   - Log in via the terminal: `npm login`

2. Ensure all changes are committed to your git repository.

## Publishing Process

### 1. Update Version (if needed)

Update the version in `package.json` using npm or manually:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm version patch

# Bump minor version (1.0.0 -> 1.1.0)
npm version minor

# Bump major version (1.0.0 -> 2.0.0)
npm version major
```

### 2. Run Tests

Make sure all tests pass before publishing:

```bash
yarn test
```

### 3. Build the Package

Build the distribution files:

```bash
yarn build
```

### 4. Publish to npm

Publish the package:

```bash
npm publish
```

If you are publishing for the first time, or publishing a scoped package as public, use:

```bash
npm publish --access=public
```

### 5. Verify the Package

Check that your package has been published correctly by visiting:
https://www.npmjs.com/package/socketnest-js

### Troubleshooting

- If npm publish fails, make sure your npm authentication is valid: `npm whoami`
- Check for any validation errors in your package.json

## Publishing a New Version

1. Make your changes to the codebase
2. Commit all changes to your repository
3. Update the version with `npm version patch|minor|major`
4. Run `npm publish`

The `prepublishOnly` script will automatically run tests and build before publishing. 