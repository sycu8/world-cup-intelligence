# Resize brand icons and OG image for production (run from repo root).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root 'public'
$source = Join-Path $public 'favicon-source.png'

function Save-ResizedPng([string]$src, [string]$dst, [int]$w, [int]$h) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()
  $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Save-ResizedCover([string]$src, [string]$dst, [int]$w, [int]$h) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $img.Dispose()
  $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $bmp.Dispose()
}

$iconSizes = @{
  'favicon-16x16.png' = 16
  'favicon-32x32.png' = 32
  'apple-touch-icon.png' = 180
  'android-chrome-192x192.png' = 192
  'android-chrome-512x512.png' = 512
}

foreach ($entry in $iconSizes.GetEnumerator()) {
  $out = Join-Path $public $entry.Key
  $size = [int]$entry.Value
  Save-ResizedPng $source $out $size $size
  $bytes = (Get-Item $out).Length
  Write-Output "$($entry.Key): ${size}x${size}, $bytes bytes"
}

$ogSrc = Join-Path $public 'og-cover.png'
$ogOut = Join-Path $public 'og-cover.jpg'
Save-ResizedCover $ogSrc $ogOut 1200 630
Write-Output "og-cover.jpg: 1200x630, $((Get-Item $ogOut).Length) bytes"
