param(
    [Parameter(Position = 0)]
    [ValidateSet('dev', 'run', 'up', 'down', 'restart', 'logs', 'status', 'ps', 'db-shell', 'redis-cli', 'generate', 'migrate', 'studio', 'build', 'test', 'reset-db', 'help')]
    [string]$Command = 'dev'
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ProjectRoot '.env'
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'

function Show-Usage {
    @'
Local development pipeline

Usage:
  powershell -File scripts/local-dev.ps1 dev        Start PostgreSQL + Redis, then run the server locally
  powershell -File scripts/local-dev.ps1 up         Start PostgreSQL + Redis
  powershell -File scripts/local-dev.ps1 down       Stop PostgreSQL + Redis
  powershell -File scripts/local-dev.ps1 restart    Restart PostgreSQL + Redis
  powershell -File scripts/local-dev.ps1 logs       Follow infrastructure logs
  powershell -File scripts/local-dev.ps1 status     Show container status
  powershell -File scripts/local-dev.ps1 db-shell   Open a psql shell in the database container
  powershell -File scripts/local-dev.ps1 redis-cli  Open a Redis CLI session in the Redis container
  powershell -File scripts/local-dev.ps1 generate   Run Prisma client generation
  powershell -File scripts/local-dev.ps1 migrate    Run Prisma migrate dev
  powershell -File scripts/local-dev.ps1 studio     Open Prisma Studio
  powershell -File scripts/local-dev.ps1 build      Build the server
  powershell -File scripts/local-dev.ps1 test       Run the test command
  powershell -File scripts/local-dev.ps1 reset-db   Stop the stack and remove volumes
'@
}

function Assert-Dependencies {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker is not installed or not available on PATH.'
    }

    if (-not (Test-Path $EnvFile)) {
        throw 'Missing .env file. Copy .env.example to .env first.'
    }
}

function Import-EnvironmentFile {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()

        if (-not [string]::IsNullOrWhiteSpace($line) -and -not $line.StartsWith('#')) {
            $parts = $line.Split('=', 2)

            if ($parts.Count -eq 2) {
                [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim())
            }
        }
    }
}

function Invoke-Compose {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    Push-Location $ProjectRoot
    try {
        & docker compose -f $ComposeFile @Arguments
    } finally {
        Pop-Location
    }
}

function Start-Infrastructure {
    Invoke-Compose up -d --wait postgres redis
}

Assert-Dependencies
Import-EnvironmentFile

switch ($Command) {
    'help' {
        Show-Usage
        break
    }
    'dev' {
        Start-Infrastructure
        Push-Location $ProjectRoot
        try {
            npm run dev
        } finally {
            Pop-Location
        }
        break
    }
    'run' {
        Start-Infrastructure
        Push-Location $ProjectRoot
        try {
            npm run dev
        } finally {
            Pop-Location
        }
        break
    }
    'up' {
        Start-Infrastructure
        break
    }
    'down' {
        Invoke-Compose down
        break
    }
    'restart' {
        Invoke-Compose down
        Start-Infrastructure
        break
    }
    'logs' {
        Invoke-Compose logs -f postgres redis
        break
    }
    'status' { Invoke-Compose ps; break }
    'ps' { Invoke-Compose ps; break }
    'db-shell' {
        $postgresUser = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER)) { 'dsms' } else { $env:POSTGRES_USER }
        $postgresDatabase = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_DB)) { 'dsms' } else { $env:POSTGRES_DB }

        Invoke-Compose exec postgres psql -U $postgresUser -d $postgresDatabase
        break
    }
    'redis-cli' {
        Invoke-Compose exec redis redis-cli
        break
    }
    'generate' {
        Push-Location $ProjectRoot
        try {
            npx prisma generate
        } finally {
            Pop-Location
        }
        break
    }
    'migrate' {
        Push-Location $ProjectRoot
        try {
            npx prisma migrate dev
        } finally {
            Pop-Location
        }
        break
    }
    'studio' {
        Push-Location $ProjectRoot
        try {
            npx prisma studio
        } finally {
            Pop-Location
        }
        break
    }
    'build' {
        Push-Location $ProjectRoot
        try {
            npm run build
        } finally {
            Pop-Location
        }
        break
    }
    'test' {
        Push-Location $ProjectRoot
        try {
            npm test
        } finally {
            Pop-Location
        }
        break
    }
    'reset-db' {
        Invoke-Compose down -v
        break
    }
}