Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile('c:\Users\Sun\Desktop\RPM-IT-Inventory\Inv React\public\rpm-logo.jpg')
$pixel = $img.GetPixel(10, 10)
Write-Host "#$($pixel.R.ToString('X2'))$($pixel.G.ToString('X2'))$($pixel.B.ToString('X2'))"
