# Security Policy

## Supported Versions

The project is currently pre-1.0. Security fixes will target the latest
published version.

| Version | Supported |
|---|---|
| 0.x | Yes |

## Reporting A Vulnerability

Please report security issues privately through GitHub Security Advisories when
available. If advisories are not enabled, open a minimal issue that does not
include exploit details and ask for a private contact path.

Do not post secrets, private repository URLs, tokens, or exploit payloads in a
public issue.

## Security Scope

Relevant issues include:

- Token leakage in GitHub Actions workflows.
- Unsafe handling of report files.
- Dependency vulnerabilities that affect CLI execution.
- Path traversal or unsafe file writes.

This project does not process production traffic and does not provide a hosted
service.
