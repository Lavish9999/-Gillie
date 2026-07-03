$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$source = Join-Path $root "assets\app-icon-1024.png"
if (!(Test-Path $source)) {
  $source = Join-Path $root "assets\gillie-icon-1024.png"
}
if (!(Test-Path $source)) {
  throw "Missing icon master. Expected assets\app-icon-1024.png or assets\gillie-icon-1024.png"
}

$appIconSet = Join-Path $root "ios\App\App\Assets.xcassets\AppIcon.appiconset"
New-Item -ItemType Directory -Force -Path $appIconSet | Out-Null

Add-Type -AssemblyName System.Drawing

$sizes = @(
  @{ idiom = "iphone"; size = "20x20"; scale = "2x"; px = 40 },
  @{ idiom = "iphone"; size = "20x20"; scale = "3x"; px = 60 },
  @{ idiom = "iphone"; size = "29x29"; scale = "2x"; px = 58 },
  @{ idiom = "iphone"; size = "29x29"; scale = "3x"; px = 87 },
  @{ idiom = "iphone"; size = "40x40"; scale = "2x"; px = 80 },
  @{ idiom = "iphone"; size = "40x40"; scale = "3x"; px = 120 },
  @{ idiom = "iphone"; size = "60x60"; scale = "2x"; px = 120 },
  @{ idiom = "iphone"; size = "60x60"; scale = "3x"; px = 180 },
  @{ idiom = "ipad"; size = "20x20"; scale = "1x"; px = 20 },
  @{ idiom = "ipad"; size = "20x20"; scale = "2x"; px = 40 },
  @{ idiom = "ipad"; size = "29x29"; scale = "1x"; px = 29 },
  @{ idiom = "ipad"; size = "29x29"; scale = "2x"; px = 58 },
  @{ idiom = "ipad"; size = "40x40"; scale = "1x"; px = 40 },
  @{ idiom = "ipad"; size = "40x40"; scale = "2x"; px = 80 },
  @{ idiom = "ipad"; size = "76x76"; scale = "1x"; px = 76 },
  @{ idiom = "ipad"; size = "76x76"; scale = "2x"; px = 152 },
  @{ idiom = "ipad"; size = "83.5x83.5"; scale = "2x"; px = 167 },
  @{ idiom = "ios-marketing"; size = "1024x1024"; scale = "1x"; px = 1024 }
)

$srcImage = [System.Drawing.Image]::FromFile($source)
$images = @()

foreach ($item in $sizes) {
  $filename = "Icon-$($item.px).png"
  $target = Join-Path $appIconSet $filename
  $bitmap = New-Object System.Drawing.Bitmap $item.px, $item.px
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($srcImage, 0, 0, $item.px, $item.px)
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  $images += @{
    idiom = $item.idiom
    size = $item.size
    scale = $item.scale
    filename = $filename
  }
}

$srcImage.Dispose()

$contents = @{
  images = $images
  info = @{
    author = "xcode"
    version = 1
  }
} | ConvertTo-Json -Depth 5

Set-Content -LiteralPath (Join-Path $appIconSet "Contents.json") -Value $contents -Encoding UTF8
Write-Host "Generated iOS app icons in $appIconSet"
