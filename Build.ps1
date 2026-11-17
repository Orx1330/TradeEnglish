$ErrorActionPreference = 'Stop'
$env:DOTNET_CLI_HOME = Join-Path $PSScriptRoot '.build-home'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'
$projectPath = Join-Path $PSScriptRoot 'Source\TradeEnglish.csproj'
$outputPath = Join-Path $PSScriptRoot 'Build\TradeEnglish'
dotnet build $projectPath -c Release -o $outputPath
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
Write-Host "Build ready: $outputPath"
