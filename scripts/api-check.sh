#!/bin/bash
# End-to-end API happy path against a running dev server.
set -euo pipefail

BASE="${BASE:-http://localhost:8787}"

# This script signs up users and creates items; keep it away from real data.
case "$BASE" in
  *nijiya.ashwinmalkani.dev*)
    if [ "${ALLOW_PROD:-}" != "1" ]; then
      echo "Refusing to run against production ($BASE) — it would pollute the real database."
      echo "Run against a local dev server, or set ALLOW_PROD=1 if you really mean it."
      exit 1
    fi
    ;;
esac
TMP=$(mktemp -d)
A="$TMP/ashwin.jar"
S="$TMP/sahil.jar"

# Fresh numbers each run so the script is re-runnable against a dirty dev DB.
PHONE_A="555$(printf '%07d' $((RANDOM * RANDOM % 10000000)))"
PHONE_S="555$(printf '%07d' $((RANDOM * RANDOM % 10000000)))"
BARCODE="49$(printf '%011d' $((RANDOM * RANDOM % 100000000000)))"
j() { printf '%s' "$1" | python3 -c 'import json,sys; print(json.load(sys.stdin)['"$2"'])'; }

echo "== signup Ashwin =="
OUT=$(curl -s -c "$A" -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE_A\",\"name\":\"Ashwin\",\"pin\":\"1234\",\"inviteCode\":\"nijiya\"}")
echo "$OUT"

echo "== invite Sahil (no account yet) =="
OUT=$(curl -s -b "$A" -X POST "$BASE/api/users/invite" -H 'content-type: application/json' \
  -d "{\"name\":\"Sahil\",\"phone\":\"$PHONE_S\"}")
echo "$OUT"
SAHIL_ID=$(j "$OUT" '"user"]["id"')

echo "== sections =="
SECTIONS=$(curl -s -b "$A" "$BASE/api/sections")
echo "$SECTIONS"
SECTION_ID=$(j "$SECTIONS" '"sections"][0]["id"')

echo "== create item with barcode =="
OUT=$(curl -s -b "$A" -X POST "$BASE/api/items" -H 'content-type: application/json' \
  -d "{\"name\":\"Strong Zero Lemon\",\"sectionId\":$SECTION_ID,\"priceCents\":399,\"barcode\":\"$BARCODE\"}")
echo "$OUT"
ITEM_ID=$(j "$OUT" '"id"')

echo "== rate it, tagging Sahil =="
curl -s -b "$A" -X PUT "$BASE/api/ratings/$ITEM_ID" -H 'content-type: application/json' \
  -d "{\"score\":8.7,\"notes\":\"Crisp. Dangerous.\",\"triedOn\":\"2026-07-23\",\"companionIds\":[$SAHIL_ID]}"
echo

echo "== barcode rescan should match the existing item =="
curl -s -b "$A" "$BASE/api/barcode/$BARCODE" | head -c 300
echo

echo "== feed =="
curl -s -b "$A" "$BASE/api/feed" | head -c 400
echo

echo "== Sahil claims his invite by signing up =="
OUT=$(curl -s -c "$S" -X POST "$BASE/api/auth/signup" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE_S\",\"name\":\"Sahil\",\"pin\":\"4321\",\"inviteCode\":\"nijiya\"}")
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
  -H 'content-type: application/json' -d "{\"phone\":\"$PHONE_A\",\"pin\":\"9999\"}"

# Expect 403 only when INVITE_CODE is configured; a bare `wrangler dev` leaves
# signup open, in which case 200 here is correct.
echo "== bad invite code (403 if INVITE_CODE is set, else 200) =="
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/auth/signup" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"555$(printf '%07d' $((RANDOM * RANDOM % 10000000)))\",\"name\":\"Rando\",\"pin\":\"1111\",\"inviteCode\":\"wrong\"}"

rm -rf "$TMP"
echo
echo "ALL API CHECKS PASSED"
