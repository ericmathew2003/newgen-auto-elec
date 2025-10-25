# Try to extract readable SQL from binary backup

Write-Host "Attempting to extract data from backup file..." -ForegroundColor Green

$backupFile = "newgen_backup.sql"

if (-not (Test-Path $backupFile)) {
    Write-Host "Backup file not found: $backupFile" -ForegroundColor Red
    exit 1
}

try {
    # Method 1: Try with strings command equivalent
    Write-Host "Extracting readable strings..."
    $content = Get-Content $backupFile -Raw -Encoding UTF8
    
    # Look for INSERT statements
    $insertMatches = [regex]::Matches($content, "INSERT INTO.*?;", [System.Text.RegularExpressions.RegexOptions]::Singleline)
    
    if ($insertMatches.Count -gt 0) {
        Write-Host "Found $($insertMatches.Count) INSERT statements" -ForegroundColor Green
        
        $extractedSQL = "-- Extracted INSERT statements from backup`n`n"
        foreach ($match in $insertMatches) {
            $extractedSQL += $match.Value + "`n"
        }
        
        $extractedSQL | Out-File -FilePath "extracted_inserts.sql" -Encoding UTF8
        Write-Host "Extracted SQL saved to: extracted_inserts.sql" -ForegroundColor Green
        
        Write-Host "`nTo import: psql 'connection_string' -f extracted_inserts.sql" -ForegroundColor Yellow
    } else {
        Write-Host "No INSERT statements found in readable format" -ForegroundColor Yellow
    }
    
    # Method 2: Look for COPY statements
    $copyMatches = [regex]::Matches($content, "COPY.*?\\\\\\.", [System.Text.RegularExpressions.RegexOptions]::Singleline)
    
    if ($copyMatches.Count -gt 0) {
        Write-Host "Found $($copyMatches.Count) COPY statements" -ForegroundColor Green
        Write-Host "COPY format detected - this needs conversion to INSERT format" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Error extracting data: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nIf extraction failed, try the online converter methods in backend/online_converter_guide.md" -ForegroundColor Cyan