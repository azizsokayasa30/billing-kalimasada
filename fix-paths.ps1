$viewsDir = "d:\job_nation\RADIUS-BILLING-19-02-26T1529\RADIUS-BILLING-19-02-26T1529\RADIUS-BILLING-19-02-26T1529\cvlmedia(oldmembertmplatevoucer)\views"
$files = Get-ChildItem "$viewsDir\*.ejs" -Recurse
$fixed = 0

foreach ($f in $files) {
    if ($f.FullName -match '\\partials\\') { continue }
    
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    if ($content -notmatch 'hard-reload') { continue }
    
    # Calculate correct relative path
    $relDir = $f.DirectoryName.Replace($viewsDir, '').TrimStart('\')
    $depth = ($relDir.Split('\') | Where-Object { $_ -ne '' }).Count
    
    if ($depth -eq 0) {
        $correctPath = "partials/hard-reload"
    } elseif ($depth -eq 1) {
        $correctPath = "../partials/hard-reload"
    } elseif ($depth -eq 2) {
        $correctPath = "../../partials/hard-reload"
    } elseif ($depth -eq 3) {
        $correctPath = "../../../partials/hard-reload"
    } else {
        $correctPath = "../../partials/hard-reload"
    }
    
    $correctInclude = "include('$correctPath')"
    
    # Check if it has a wrong path
    if ($content -match "include\('[^']*hard-reload'\)" -and $content -notmatch [regex]::Escape($correctInclude)) {
        $newContent = $content -replace "include\('[^']*hard-reload'\)", $correctInclude
        Set-Content -Path $f.FullName -Value $newContent -NoNewline
        $fixed++
        $shortName = $f.FullName.Replace($viewsDir + '\', '')
        Write-Output "FIXED: $shortName -> $correctPath"
    }
}

Write-Output "`nTotal fixed: $fixed"
