#!/bin/bash
echo "=== PRODUCTION DIAGNOSTIC CHECK ==="
echo ""
echo "1. Checking source file (server/routes.ts) for new code..."
if grep -q "const subjectMap = new Map()" server/routes.ts; then
  echo "✅ Source file has NEW code (Map deduplication)"
else
  echo "❌ Source file has OLD code - need to pull from git!"
fi
echo ""

echo "2. Checking compiled file (dist/index.js) for new code..."
if grep -q "subjectMap" dist/index.js; then
  echo "✅ Compiled file has NEW code"
else
  echo "❌ Compiled file has OLD code - need to rebuild!"
fi
echo ""

echo "3. Showing exact code from server/routes.ts (lines 1652-1663)..."
sed -n '1652,1663p' server/routes.ts
echo ""

echo "4. Current git commit..."
git log --oneline -1
echo ""

echo "5. Checking for uncommitted changes..."
git status --short
echo ""

echo "=== DIAGNOSTIC COMPLETE ==="
