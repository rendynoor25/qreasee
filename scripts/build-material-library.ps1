# Generates Qreasee's material library from a local sample library.
#
#   scripts/build-material-library.ps1 [-Source <dir>]
#
# - copies each material's texture into apps/web/public/materials/<id>.<ext>
# - writes packages/shared/src/materialLibrary.json (name, group, brand, tags,
#   average colour, texture path, texture scale)
#
# Windows/PowerShell because the source library ships as folders + JPEGs and we
# need image decoding for the average colour (System.Drawing). Re-runnable.

param(
  [string]$Source = 'D:\Dirory\sample_library\Materials'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'pnpm-workspace.yaml'))) { $repo = Split-Path -Parent $repo }
$publicDir = Join-Path $repo 'apps\web\public\materials'
$manifestPath = Join-Path $repo 'packages\shared\src\materialLibrary.json'
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

function Get-Slug([string]$text) {
  $s = $text.ToLowerInvariant()
  $s = [System.Text.RegularExpressions.Regex]::Replace($s, '[^a-z0-9]+', '-')
  return $s.Trim('-')
}

function Get-AverageColor([string]$path) {
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $tiny = New-Object System.Drawing.Bitmap 1, 1
    $g = [System.Drawing.Graphics]::FromImage($tiny)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($bmp, 0, 0, 1, 1)
    $c = $tiny.GetPixel(0, 0)
    $hex = '#{0:x2}{1:x2}{2:x2}' -f $c.R, $c.G, $c.B
    $g.Dispose(); $tiny.Dispose(); $bmp.Dispose()
    return $hex
  } catch { return '#b9b9b5' }
}

function Get-Category([string]$group) {
  switch -Regex ($group) {
    'Woodgrain|Timber|Wood' { return 'wood' }
    'Tile'                  { return 'floor' }
    default                 { return 'wall' }
  }
}

function Get-TextureScale([string]$group) {
  switch -Regex ($group) {
    'Tile'                  { return 600 }
    'Woodgrain|Timber|Wood' { return 1200 }
    default                 { return 1000 }
  }
}

$entries = New-Object System.Collections.Generic.List[object]
$usedIds = New-Object System.Collections.Generic.HashSet[string]

function Add-Entry {
  param(
    [string]$Name,
    [string]$Group,
    [string]$Brand,
    [string[]]$Tags,
    [string]$ImagePath,
    [string]$IdBase
  )
  if (-not (Test-Path $ImagePath)) { return }
  $ext = [System.IO.Path]::GetExtension($ImagePath).ToLowerInvariant()
  $id = Get-Slug $IdBase
  if ([string]::IsNullOrWhiteSpace($id)) { $id = 'material' }
  $base = $id; $n = 2
  while ($usedIds.Contains($id)) { $id = "$base-$n"; $n++ }
  [void]$usedIds.Add($id)

  $fileName = "$id$ext"
  Copy-Item -LiteralPath $ImagePath -Destination (Join-Path $publicDir $fileName) -Force

  $entries.Add([ordered]@{
    id           = $id
    name         = $Name
    group        = $Group
    brand        = $Brand
    category     = (Get-Category $Group)
    tags         = $Tags
    texture      = "materials/$fileName"
    color        = (Get-AverageColor $ImagePath)
    roughness    = 0.85
    textureScaleMm = (Get-TextureScale $Group)
  })
}

# --- Folder-per-material (meta.json) ---------------------------------------
Get-ChildItem -Path $Source -Recurse -File -Filter 'meta.json' | ForEach-Object {
  $dir = $_.Directory
  try { $meta = Get-Content $_.FullName -Raw | ConvertFrom-Json } catch { return }
  if ($meta.type -and $meta.type -ne 'material') { return }

  $image = $null
  if ($meta.thumbnail) {
    $candidate = Join-Path $dir.FullName $meta.thumbnail
    if (Test-Path $candidate) { $image = $candidate }
  }
  if (-not $image) {
    $image = (Get-ChildItem -Path $dir.FullName -File | Where-Object { $_.Extension -in '.jpeg', '.jpg', '.png' } | Select-Object -First 1).FullName
  }
  if (-not $image) { return }

  $rel = $dir.FullName.Substring($Source.Length).TrimStart('\')
  $parts = $rel -split '\\'
  $group = if ($meta.category) { $meta.category } elseif ($parts.Count -ge 2) { $parts[1] } else { $parts[0] }
  $brand = if ($meta.brand) { $meta.brand } elseif ($parts.Count -ge 2) { $parts[1] } else { $parts[0] }
  $name = if ($meta.name) { $meta.name } else { $dir.Name }
  $tags = @(); if ($meta.tags) { $tags = @($meta.tags) }

  Add-Entry -Name $name -Group $group -Brand $brand -Tags $tags -ImagePath $image -IdBase $rel
}

# --- Tile CSV catalogue -----------------------------------------------------
Get-ChildItem -Path $Source -Recurse -File -Filter '*.csv' | ForEach-Object {
  $csv = $_.FullName
  $rows = Import-Csv -Path $csv
  $libraryRoot = Split-Path -Parent $Source
  foreach ($row in $rows) {
    if (-not $row.file) { continue }
    $img = Join-Path $libraryRoot ($row.file -replace '/', '\')
    if (-not (Test-Path $img)) { continue }
    $group = 'Tiles'
    $brand = if ($row.line) { "$($row.line)" } else { 'Tiles' }
    $name = ("{0} {1}" -f $row.code, $row.name).Trim()
    $size = if ($row.size_cm) { $row.size_cm } else { '' }
    $tags = @($row.line, $row.series, $row.code, $row.name, $row.size_cm) | Where-Object { $_ }
    $idBase = "tiles-$($row.series)-$($row.code)-$($row.name)-$size"
    Add-Entry -Name $name -Group $group -Brand $brand -Tags $tags -ImagePath $img -IdBase $idBase
  }
}

$manifest = [ordered]@{
  version     = 1
  source      = $Source
  generatedAt = (Get-Date).ToString('o')
  count       = $entries.Count
  materials   = $entries
}
$json = $manifest | ConvertTo-Json -Depth 6
Set-Content -Path $manifestPath -Value $json -Encoding UTF8

Write-Output ("Materials: {0}" -f $entries.Count)
Write-Output ("Textures : {0}" -f (Get-ChildItem $publicDir -File).Count)
Write-Output ("Manifest : {0}" -f $manifestPath)
Write-Output ("Public   : {0}" -f $publicDir)
