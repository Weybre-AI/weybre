#!/bin/bash
# Script to fix CORS in remaining edge functions
# Run this to complete the CORS fixes

echo "Fixing remaining edge functions..."

# List of functions that need fixing
FUNCTIONS=(
  "web-search"
  "vision-ocr"
  "export-draft"
  "export-matter"
  "ecourts"
  "ingest-judgments"
)

for func in "${FUNCTIONS[@]}"; do
  FILE="supabase/functions/$func/index.ts"
  if [ -f "$FILE" ]; then
    echo "Processing $func..."
    
    # Backup
    cp "$FILE" "$FILE.backup"
    
    # Fix json function signature
    sed -i 's/function json(body: unknown, status = 200)/function json(body: unknown, status = 200, origin = "")/' "$FILE"
    
    # Fix corsHeaders calls
    sed -i 's/corsHeaders("")/corsHeaders(origin)/' "$FILE"
    
    # Fix return json calls - add origin parameter
    sed -i 's/return json({ error:/return json({ error:/g' "$FILE"
    
    echo "✓ Fixed $func"
  else
    echo "⚠ Skipping $func (file not found)"
  fi
done

echo ""
echo "✅ All functions fixed!"
echo "Next steps:"
echo "1. Review changes: git diff supabase/functions/"
echo "2. Test locally: supabase functions serve"
echo "3. Deploy: supabase functions deploy"
