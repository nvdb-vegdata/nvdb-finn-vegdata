#!/usr/bin/env bash
USAGE="Usage: ./deploy-atlas.sh <env> <image-tag> [responsible-user]"
set -euo pipefail

ENV_NAME="${1:?$USAGE}"
TAG="${2:?$USAGE}"
RESPONSIBLE_USER="${3:-}"
DEPLOY="nvdb-finn-vegdata"
IKT_LOSNING="nvdbapil"

FILE="atlas/$ENV_NAME/$DEPLOY.json"
BACKUP="$FILE.bak.$(date +%s)"
TMP="$(mktemp)"

[[ -f "$FILE" ]] || { echo "Missing: $FILE" >&2; exit 1; }

restore() {
  if [[ -f "$BACKUP" ]]; then
    cp -f "$BACKUP" "$FILE" || true
    rm -f "$BACKUP"
  fi
  rm -f "$TMP"
}
trap restore EXIT

cp -f "$FILE" "$BACKUP"

jq --arg tag "$TAG" '.spec.image.spec.tag = $tag' "$FILE" > "$TMP"
mv -f "$TMP" "$FILE"

(
  cd atlas
  if [[ -n "$RESPONSIBLE_USER" ]]; then
    ac deploy -e "$ENV_NAME" -i "$IKT_LOSNING" "$DEPLOY" --block-until-finished --responsible-user "$RESPONSIBLE_USER"
  else
    ac deploy -e "$ENV_NAME" -i "$IKT_LOSNING" "$DEPLOY" --block-until-finished
  fi
)
