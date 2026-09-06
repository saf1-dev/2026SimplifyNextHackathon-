$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'submission'
$archive = Join-Path $outputRoot 'MotoMoto-V2.zip'

# Remove only staging directories created by older versions of this script.
$tempRoot = [System.IO.Path]::GetTempPath().TrimEnd('\')
Get-ChildItem -LiteralPath $tempRoot -Directory -Filter 'motomoto-submission-*' | ForEach-Object {
  if ($_.FullName.StartsWith($tempRoot + '\')) { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
$git = (Get-Command git -ErrorAction Stop).Source
if (Test-Path -LiteralPath (Join-Path $projectRoot '.git-v2')) {
  $gitDirArgument = '--git-dir=' + (Join-Path $projectRoot '.git-v2')
  $workTreeArgument = '--work-tree=' + $projectRoot
  $outputArgument = '--output=' + $archive
  & $git $gitDirArgument $workTreeArgument archive --format=zip $outputArgument HEAD
} else {
  $outputArgument = '--output=' + $archive
  & $git -C $projectRoot archive --format=zip $outputArgument HEAD
}
if ($LASTEXITCODE -ne 0) { throw "git archive failed with exit code $LASTEXITCODE" }
$sizeMb = [math]::Round((Get-Item -LiteralPath $archive).Length / 1MB, 2)
Write-Host "Created $archive ($sizeMb MB) from committed files only."
