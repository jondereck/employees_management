param(
  [ValidateSet("check", "init", "dry-run", "mine", "search", "wake-up", "status", "mcp")]
  [string]$Action = "check",
  [string]$Query = "",
  [string]$ProjectPath = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$Wing = "employees_management"
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not available in PATH. See docs/mempalace-memory.md for setup."
  }
}

function Run-MemPalace {
  param([string[]]$Args)

  Require-Command "mempalace"
  & mempalace @Args
}

switch ($Action) {
  "check" {
    if (Get-Command "uv" -ErrorAction SilentlyContinue) {
      uv --version
    } else {
      Write-Host "uv is not installed or not available in PATH."
    }

    if (Get-Command "mempalace" -ErrorAction SilentlyContinue) {
      mempalace --help
    } else {
      Write-Host "mempalace is not installed or not available in PATH."
    }
  }
  "init" {
    Run-MemPalace @("init", $ProjectPath, "--yes")
  }
  "dry-run" {
    Run-MemPalace @("mine", $ProjectPath, "--wing", $Wing, "--dry-run")
  }
  "mine" {
    Run-MemPalace @("mine", $ProjectPath, "--wing", $Wing)
  }
  "search" {
    if ([string]::IsNullOrWhiteSpace($Query)) {
      throw "Search requires -Query."
    }

    Run-MemPalace @("search", $Query, "--wing", $Wing)
  }
  "wake-up" {
    Run-MemPalace @("wake-up", "--wing", $Wing)
  }
  "status" {
    Run-MemPalace @("status")
  }
  "mcp" {
    Run-MemPalace @("mcp")
  }
}
