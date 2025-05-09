`# Simple script to reset database and apply schema with Supabase CLI

Write-Host "This script will reset your database schema and apply the new schema" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "IMPORTANT: This will delete all existing data!" -ForegroundColor Red
Write-Host "--------------------------------------------------------------------" -ForegroundColor Yellow

$confirm = Read-Host "Are you sure you want to continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit    
}

Write-Host "Step 1: Resetting database schema..." -ForegroundColor Cyan
supabase db reset

Write-Host "Step 2: Pushing custom SQL schema..." -ForegroundColor Cyan
supabase db push

Write-Host "All done! Your database schema has been updated." -ForegroundColor Green 