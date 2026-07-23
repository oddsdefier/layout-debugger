# Security Policy

## Supported versions

Layout Debugger is currently maintained on the `main` branch. Security fixes are applied to the latest version only.

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue.

Use GitHub’s private vulnerability reporting feature from the repository’s **Security** tab when it is available. Include:

- a clear description of the issue;
- steps to reproduce it;
- the affected browser and extension version;
- the possible impact;
- a suggested fix, when known.

If private vulnerability reporting is unavailable, contact the maintainer privately using a contact method listed on the maintainer’s GitHub profile.

You can expect an initial acknowledgment when the report has been reviewed. Please allow reasonable time for investigation and remediation before public disclosure.

## Security-sensitive areas

Changes involving these areas require extra review:

- browser permissions and host access;
- content-script injection;
- messages between the page, content script, service worker, and side panel;
- DOM data collected from inspected pages;
- local storage of extension settings;
- use of external services or remote code.

The extension must not introduce remote code execution or silently transmit inspected page data to third parties.