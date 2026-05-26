# MemPalace Project Memory

MemPalace is a local-first AI memory tool. For this project, use it as a developer workflow helper only. Do not add it as a runtime dependency of the Next.js app unless there is a separate product requirement.

Official sources:

- GitHub: https://github.com/MemPalace/mempalace
- Docs: https://mempalaceofficial.com/
- PyPI package: https://pypi.org/project/mempalace/

Avoid other domains. The MemPalace docs warn that unofficial domains may be unsafe.

## What We Use It For

- Search project architecture and implementation details.
- Recall previous decisions and code paths.
- Load context before starting a new coding session.
- Keep memory local instead of sending project history to a cloud service.

## What We Do Not Mine

Do not index secrets, generated output, production-like data snapshots, or personal employee records.

The project `.gitignore` excludes these from default MemPalace mining:

- `.env`
- `.env*.local`
- `.next/`
- `node_modules/`
- `backups/`
- `.mempalace/`
- `temp.txt`
- `sandbox-test/`
- `sandbox-test-expanded/`

MemPalace project mining respects `.gitignore` by default. Do not use `--no-gitignore` for this repo.

## One-Time Setup

Install the CLI in an isolated Python tool environment:

```powershell
winget install Astral.UV
uv tool install mempalace
```

Then initialize the project wing:

```powershell
mempalace init C:\Users\User\employees_management --yes
```

## Safe Project Mining

Preview first:

```powershell
mempalace mine C:\Users\User\employees_management --wing employees_management --dry-run
```

If the preview does not include sensitive files, mine the repo:

```powershell
mempalace mine C:\Users\User\employees_management --wing employees_management
```

## Search Examples

```powershell
mempalace search "public employee view layout" --wing employees_management
mempalace search "department dashboard authorization" --wing employees_management
mempalace search "Prisma employee model lifecycle fields" --wing employees_management
```

## Load Context Before Work

```powershell
mempalace wake-up --wing employees_management
```

## Codex MCP Integration

After the CLI works, ask MemPalace to print the exact MCP setup command:

```powershell
mempalace mcp
```

The official docs also show the manual Codex form:

```powershell
codex mcp add mempalace -- python -m mempalace.mcp_server
```

Restart Codex after adding the MCP server so the MemPalace tools become available.

## Maintenance

Run this after meaningful repo changes:

```powershell
mempalace mine C:\Users\User\employees_management --wing employees_management
```

Check the indexed memory status:

```powershell
mempalace status
```
