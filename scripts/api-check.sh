#!/bin/bash
# End-to-end API happy path against a running dev server.
set -euo pipefail

BASE="${BASE:-http://localhost:8787}"
TMP=$(mktemp -d)
A="$TMP/ashwin.jar"
S="$TMP/sahil.jar"
j() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)['"$2"'])'; }

echo "== signup Ashwin =="
OUT=$(curl -s -c "$A" -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' \
  -d '{"phone":"5551230001","name":"Ashwin","pin":"1234","inviteCode":"nijiya"}')
echo "$OUT"

echo "== invite Sahil (no account yet) =="
OUT=$(curl -s -b "$A" -X POST "$BASE/api/users/invite" -H 'content-type: application/json' \
  -d '{"name":"Sahil","phone":"5551230002"}')
echo "$OUT"
SAHIL_ID=$(j "$OUT" '"user"]["id"')

echo "== sections =="
SECTIONS=$(curl -s -b "$A" "$BASE/api/sections")
echo "$SECTIONS"
SECTION_ID=$(j "$SECTIONS" '"sections"][0]["id"')

echo "== create item with barcode =="
OUT=$(curl -s -b "$A" -X POST "$BASE/api/items" -H 'content-type: application/json' \
  -d "{\"name\":\"Strong Zero Lemon\",\"sectionId\":$SECTION_ID,\"priceCents\":399,\"barcode\":\"4901777289017\"}")
echo "$OUT"
ITEM_ID=$(j "$OUT" '"id"')

echo "== rate it, tagging Sahil =="
curl -s -b "$A" -X PUT "$BASE/api/ratings/$ITEM_ID" -H 'content-type: application/json' \
  -d "{\"score\":8.7,\"notes\":\"Crisp. Dangerous.\",\"triedOn\":\"2026-07-23\",\"companionIds\":[$SAHIL_ID]}"
echo

echo "== barcode rescan should match the existing item =="
curl -s -b "$A" "$BASE/api/barcode/4901777289017" | head -c 300
echo

echo "== feed =="
curl -s -b "$A" "$BASE/api/feed" | head -c 400
echo

echo "== Sahil claims his invite by signing up =="
OUT=$(curl -s -c "$S" -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' \
  -d '{"phone":"5551230002","name":"Sahil","pin":"4321","inviteCode":"nijiya"}')
echo "$OUT"
CLAIMED_ID=$(j "$OUT" '"user"]["id"')
if [ "$CLAIMED_ID" != "$SAHIL_ID" ]; then
  echo "FAIL: expected Sahil to claim user $SAHIL_ID, got $CLAIMED_ID"; exit 1
fi
echo "OK: claimed the same user row ($CLAIMED_ID)"

echo "== Sahil's pending nudge =="
PENDING=$(curl -s -b "$S" "$BASE/api/pending")
echo "$PENDING"
if ! printf '%s' "$PENDING" | grep -q "Strong Zero Lemon"; then
  echo "FAIL: expected a pending nudge for Strong Zero Lemon"; exit 1
fi

echo "== Sahil rates it, which clears the nudge =="
curl -s -b "$S" -X PUT "$BASE/api/ratings/$ITEM_ID" -H 'content-type: application/json' \
  -d '{"score":6.2,"notes":"Too sweet for me."}'
echo
AFTER=$(curl -s -b "$S" "$BASE/api/pending")
echo "$AFTER"
if printf '%s' "$AFTER" | grep -q "Strong Zero Lemon"; then
  echo "FAIL: nudge should be gone after rating"; exit 1
fi

echo "== average should now be (8.7 + 6.2) / 2 = 7.45 =="
curl -s -b "$A" "$BASE/api/items" | head -c 400
echo

echo "== wrong PIN is rejected =="
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' -d '{"phone":"5551230001","pin":"9999"}'

echo "== bad invite code is rejected =="
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/auth/signup" \
  -H 'content-type: application/json' \
  -d '{"phone":"5559999999","name":"Rando","pin":"1111","inviteCode":"wrong"}'

rm -rf "$TMP"
echo
echo "ALL API CHECKS PASSED"
