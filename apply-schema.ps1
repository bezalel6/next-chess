# Apply Schema Script for Next Chess

# Check if we're in the right directory
if (-not (Test-Path ".\supabase\migrations\20250513092027_remote_schema.sql")) {
    Write-Host "Error: Schema file not found. Please run this script from the project root directory." -ForegroundColor Red
    exit 1
}

Write-Host "Starting database reset and schema application..." -ForegroundColor Cyan

# Reset the database first
try {
    Write-Host "Resetting database..." -ForegroundColor Yellow
    $resetOutput = npx supabase db reset --linked reset-db.sql
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Database reset failed. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Database reset successful!" -ForegroundColor Green
}
catch {
    Write-Host "Error during database reset: $_" -ForegroundColor Red
    exit 1
}

# Apply the new schema
try {
    Write-Host "Applying new schema..." -ForegroundColor Yellow
    $schemaOutput = npx supabase db push
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Schema application failed. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Schema applied successfully!" -ForegroundColor Green
}
catch {
    Write-Host "Error during schema application: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Database reset and schema application completed successfully!" -ForegroundColor Cyan 