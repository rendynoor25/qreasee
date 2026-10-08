# Builds Qreasee's own material library.
#
#   scripts/build-qreasee-materials.ps1 [-Source <dir>]
#
# - copies a curated set of BRAND-FREE textures from the sample library into
#   apps/web/public/materials/qr-*.<ext>
# - generates grass and glass textures (System.Drawing)
# - writes packages/shared/src/qreaseeMaterials.json (bilingual names, category,
#   average colour, texture path, scale, opacity)
#
# Re-runnable. Windows/PowerShell because the source ships as JPEGs and we need
# image decoding for the average colour.

param(
  [string]$Source = 'D:\Dirory\sample_library\Materials'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repo 'pnpm-workspace.yaml'))) { $repo = Split-Path -Parent $repo }
$publicDir = Join-Path $repo 'apps\web\public\materials'
$manifestPath = Join-Path $repo 'packages\shared\src\qreaseeMaterials.json'
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

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

# id, en, idName, category, roughness, scale, opacity, source (relative to $Source) or "" for generated
$rows = @(
  @{ id='qr-brick-brown';       en='Clay brick (brown)';  idn='Bata tanah liat (coklat)'; cat='wall';    rough=0.9;  scale=800;  op=1;    src='Brick\Brown Clay Brick\brick_brown_clay.jpg' },
  @{ id='qr-brick-red';         en='Exposed red brick';   idn='Bata merah ekspos';        cat='wall';    rough=0.9;  scale=800;  op=1;    src='Brick\Exposed Red Brick\brick_exposed_red.jpg' },
  @{ id='qr-brick-white';       en='White brick';         idn='Bata putih';               cat='wall';    rough=0.85; scale=800;  op=1;    src='Brick\White Brick\brick_white.jpg' },
  @{ id='qr-concrete-fair';     en='Fair-face concrete';  idn='Beton ekspos halus';       cat='wall';    rough=0.85; scale=1000; op=1;    src='Concrete\Fair Face Concrete\concrete_fair_face.jpg' },
  @{ id='qr-concrete-screed';   en='Concrete screed';     idn='Screed beton';             cat='floor';   rough=0.9;  scale=1000; op=1;    src='Concrete\Concrete Screed\concrete_screed.jpg' },
  @{ id='qr-concrete-paving';   en='Concrete paving';     idn='Paving beton';             cat='floor';   rough=0.9;  scale=600;  op=1;    src='Concrete\Concrete Paving\concrete_paving.jpg' },
  @{ id='qr-stone-andesite';    en='Andesite';            idn='Batu andesit';             cat='wall';    rough=0.95; scale=600;  op=1;    src='Stone\Andesite Stone\stone_andesite.jpg' },
  @{ id='qr-stone-granite';     en='Black granite';       idn='Granit hitam';             cat='floor';   rough=0.25; scale=600;  op=1;    src='Stone\Black Granite\stone_black_granite.jpg' },
  @{ id='qr-stone-limestone';   en='Cream limestone';     idn='Batu kapur krem';          cat='wall';    rough=0.9;  scale=800;  op=1;    src='Stone\Cream Limestone\stone_limestone.jpg' },
  @{ id='qr-wood-walnut';       en='Dark walnut';         idn='Kayu walnut gelap';        cat='wood';    rough=0.55; scale=1200; op=1;    src='Wood\Dark Walnut\wood_walnut.jpg' },
  @{ id='qr-wood-oak';          en='Light oak';           idn='Kayu oak terang';          cat='wood';    rough=0.55; scale=1200; op=1;    src='Wood\Light Oak\wood_light_oak.jpg' },
  @{ id='qr-wood-teak';         en='Natural teak';        idn='Kayu jati alami';          cat='wood';    rough=0.55; scale=1200; op=1;    src='Wood\Natural Teak\wood_teak.jpg' },
  @{ id='qr-timber-plank';      en='Timber plank';        idn='Papan kayu';               cat='wood';    rough=0.6;  scale=1200; op=1;    src='Timber\WOOD1\Wood Plank 01.png' },
  @{ id='qr-paint-charcoal';    en='Charcoal paint';      idn='Cat arang';                cat='wall';    rough=0.88; scale=1000; op=1;    src='Paint\Charcoal Paint\paint_charcoal.jpg' },
  @{ id='qr-paint-lightgrey';   en='Light grey paint';    idn='Cat abu terang';           cat='wall';    rough=0.88; scale=1000; op=1;    src='Paint\Light Grey Paint\paint_light_grey.jpg' },
  @{ id='qr-roof-clay';         en='Clay roof tile';      idn='Genteng tanah liat';       cat='roof';    rough=0.9;  scale=600;  op=1;    src='Roof\Clay Tile Roof\roof_clay_tile.jpg' },
  @{ id='qr-roof-concrete';     en='Concrete roof tile';  idn='Genteng beton';            cat='roof';    rough=0.85; scale=600;  op=1;    src='Roof\Concrete Roof Tile\roof_concrete_tile.jpg' },
  @{ id='qr-roof-metal';        en='Metal roof';          idn='Atap metal';               cat='roof';    rough=0.45; scale=1000; op=1;    src='Roof\Metal Roof\roof_metal.jpg' },
  @{ id='qr-metal-brushed';     en='Brushed aluminium';   idn='Aluminium sikat';          cat='metal';   rough=0.35; scale=1000; op=1;    src='Metal\Brushed Aluminium\metal_brushed_aluminium.jpg' },
  @{ id='qr-metal-galvanized';  en='Galvanized steel';    idn='Baja galvanis';            cat='metal';   rough=0.4;  scale=1000; op=1;    src='Metal\Galvanized Steel\metal_galvanized.jpg' },
  @{ id='qr-metal-black';       en='Matte black metal';   idn='Metal hitam dof';          cat='metal';   rough=0.5;  scale=1000; op=1;    src='Metal\Matte Black Metal\metal_matte_black.jpg' },
  @{ id='qr-grass';             en='Grass';               idn='Rumput';                   cat='floor';   rough=0.95; scale=800;  op=1;    src='' },
  @{ id='qr-glass-clear';       en='Clear glass';         idn='Kaca bening';              cat='glass';   rough=0.08; scale=1000; op=0.35; src='' },
  @{ id='qr-glass-frosted';     en='Frosted glass';       idn='Kaca buram';               cat='glass';   rough=0.45; scale=1000; op=0.6;  src='' }
)

function New-NoiseTexture([string]$path, [string]$kind) {
  $size = 256
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $rnd = New-Object System.Random 1234
  for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
      if ($kind -eq 'grass') {
        $n = $rnd.Next(0, 40)
        $r = 46 + [int]($n * 0.5); $g = 104 + $n; $b = 42 + [int]($n * 0.4)
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
      } else {
        # translucent glass: low alpha with a soft diagonal highlight
        $edge = [Math]::Abs((($x + $y) % 128) - 64) / 64.0
        $a = 36 + [int](74 * $edge)
        $r = 205 + $rnd.Next(0, 12); $g = 226 + $rnd.Next(0, 12); $b = 240 + $rnd.Next(0, 12)
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, $r, $g, $b))
      }
    }
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$entries = New-Object System.Collections.Generic.List[object]
foreach ($row in $rows) {
  if ([string]::IsNullOrWhiteSpace($row.src)) {
    $file = "$($row.id).png"
    New-NoiseTexture (Join-Path $publicDir $file) ($(if ($row.id -eq 'qr-grass') { 'grass' } else { 'glass' }))
  } else {
    $sourcePath = Join-Path $Source $row.src
    if (-not (Test-Path $sourcePath)) { Write-Warning "missing $sourcePath"; continue }
    $ext = [System.IO.Path]::GetExtension($sourcePath).ToLowerInvariant()
    $file = "$($row.id)$ext"
    Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $publicDir $file) -Force
  }
  $color = Get-AverageColor (Join-Path $publicDir $file)
  $entries.Add([ordered]@{
    id             = $row.id
    name           = @{ en = $row.en; id = $row.idn }
    category       = $row.cat
    color          = $color
    roughness      = $row.rough
    opacity        = $row.op
    texture        = "materials/$file"
    textureScaleMm = $row.scale
  })
}

$manifest = [ordered]@{
  version     = 1
  generatedAt = (Get-Date).ToString('o')
  count       = $entries.Count
  materials   = $entries
}
Set-Content -Path $manifestPath -Value ($manifest | ConvertTo-Json -Depth 6) -Encoding UTF8

Write-Output ("Qreasee materials: {0}" -f $entries.Count)
Write-Output ("Manifest: {0}" -f $manifestPath)
