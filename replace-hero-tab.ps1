$path = "C:\Users\pikip\Documents\digimarket\premium-hub\premiumhub-web\src\components\admin\banners-page.tsx"
$lines = Get-Content $path
$newSection = Get-Content "C:\Users\pikip\Documents\digimarket\premium-hub\sosmed-hero-tab.txt"

# Keep lines 0-745 (before SOSMED_HERO_ICONS), replace rest
$out = @()
for ($i = 0; $i -lt 746; $i++) {
    $out += $lines[$i]
}
foreach ($line in $newSection) {
    $out += $line
}

$out | Set-Content $path
Write-Host "DONE - $($out.Length) lines"
