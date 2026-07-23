# Contributing to Layout Debugger

Thanks for considering a contribution. Layout Debugger is an early-stage open-source browser extension, so small, focused improvements are especially useful.

## Before you start

- Search existing issues before opening a new one.
- Use an issue for larger changes so the approach can be discussed first.
- Keep pull requests focused on one problem.
- Do not include unrelated formatting or generated-file changes.

## Local development

1. Fork and clone the repository.
2. Open `chrome://extensions/` in a Chromium-based browser.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository directory.
5. After changing files, reload the extension and refresh the page being tested.

No build step is currently required.

## Making changes

- Keep the extension compatible with Manifest V3.
- Prefer clear browser APIs and plain JavaScript over unnecessary dependencies.
- Preserve keyboard access and readable labels in the side panel.
- Avoid requesting new browser permissions unless the feature requires them.
- Update documentation when behavior changes.

## Testing

Before opening a pull request, test at least the following:

- The side panel opens from the extension icon.
- Borders can be enabled and disabled.
- Element selection and hover inspection work.
- Parent, previous, next, and child navigation work.
- Settings persist after the side panel is reopened.
- Unsupported pages fail with a clear message instead of breaking.

Include the browser and operating system used for testing in the pull request.

## Commit and pull request guidance

Use concise commit messages such as:

- `fix: prevent stale hover selection`
- `feat: show grid track information`
- `docs: clarify local installation`

A pull request should explain:

- what changed;
- why it changed;
- how it was tested;
- screenshots or recordings for visible UI changes.

## Reporting security issues

Do not disclose security vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md).

## Community standards

Participation in this project is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).