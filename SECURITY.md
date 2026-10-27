# Security Policy

## Supported Versions

EncodeX is currently in pre-release. The current version is `1.0.0-beta.5`, and there is no stable `1.0` release yet. Security fixes are released on the current pre-release line only.

| Version                     | Supported                                                |
| --------------------------- | -------------------------------------------------------- |
| 1.0.0-beta.5 (current)      | Yes — receives security fixes                            |
| 1.0.0-beta.0 – 1.0.0-beta.4 | No — no longer supported, upgrade to the current release |
| 1.0.0 (stable)              | Not yet released                                         |

Older beta lines are no longer supported and will not receive fixes. If you find a vulnerability in an unsupported version, please report it anyway — we may still be able to tell you whether the issue is fixed in the current release.

## Reporting a Vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability reporting:

**[Report a vulnerability](https://github.com/Sandeepv68/EncodeX/security/advisories/new)**

This is also reachable from the **Security** tab of the repository → **Report a vulnerability**. Using the private advisory route is the preferred way to reach us, because it gives you a private thread to discuss the issue with the maintainers.

**Do NOT report security vulnerabilities through public GitHub issues, discussions, or pull requests.** A public issue exposes the flaw to everyone before a fix exists, which means attackers can act on it immediately and users have no chance to update. Reporting privately gives the maintainers time to reproduce the issue, assess severity, and ship a fix before the details become public.

If private reporting is unavailable to you, you may email <developer@encodex.in> with the same information, but the private advisory route is faster and preferred.

### What to Include

A good report helps us triage quickly. Please include:

- **Affected version** — the exact EncodeX version (e.g. `1.0.0-beta.5`) and, if relevant, the commit or build you are running.
- **Environment** — operating system and version, architecture, and how EncodeX was installed.
- **Reproduction steps** — clear, step-by-step instructions that we can follow to reproduce the issue, including the input files or commands involved.
- **Impact** — what an attacker can achieve (e.g. arbitrary file read/write, code execution, information disclosure) and what access is required.
- **Proof of concept** — a script, sample input, or screen recording, if you have one. This is optional but greatly speeds up triage.

Please **do not** include:

- Third-party credentials, API keys, tokens, or any other secrets that are not yours to share.
- Reports of unrelated vulnerabilities that are not in scope (see [Scope](#scope) below).

## Response Timeline

We aim to handle reports on the following schedule:

| Stage                                           | Target                      |
| ----------------------------------------------- | --------------------------- |
| Acknowledge receipt of the report               | Within 48 hours             |
| Triage and severity assessment                  | Within 7 days               |
| Fix or mitigation plan shared with the reporter | Within 14 days              |
| Release for critical/high severity issues       | As soon as the fix is ready |

The reporter is kept informed throughout the process, including when a report is declined, when severity changes, and when a fix ships. If a timeline needs to change, we will say so rather than going silent.

## Disclosure

We follow coordinated disclosure:

- We ask for **90 days** before public disclosure, or until a fix ships, whichever comes sooner.
- We will credit the reporter in the advisory, in the release notes, or in the published write-up — unless the reporter asks us not to.
- We will publish a security advisory describing the issue and the fix, so users can check whether they are affected and update accordingly.

If a fix cannot be completed within the agreed window, or if disclosure is required to protect users, we will coordinate with the reporter and agree on a timeline before going public.

## Scope

**In scope:**

- The EncodeX application itself — the Electron main process, preload scripts, and renderer code.
- The bundled FFmpeg/ffprobe invocation surface — argument construction, path handling, and command execution as performed by EncodeX.
- The MCP server and its HTTP transport, including request parsing, authentication, and local-only access assumptions.
- The EncodeX CLI (`encodex`).

**Out of scope:**

- **Vulnerabilities in upstream FFmpeg itself.** Please report those to the [FFmpeg project](https://ffmpeg.org/security.html), not to us. We are happy to help you apply an upstream fix once it is available.
- **Social engineering** of maintainers or users, including phishing and impersonation.
- **Denial of service caused by locally supplied malformed media** that the application already rejects gracefully — for example, a corrupt file that produces an error dialog rather than a crash or a hang.
- **Issues in third-party npm dependencies.** Report those to [npm](https://www.npmjs.com/advisories) so the dependency can be fixed and released independently.

If you are unsure whether a finding is in scope, report it privately anyway — we would rather triage it than have you publish it.
