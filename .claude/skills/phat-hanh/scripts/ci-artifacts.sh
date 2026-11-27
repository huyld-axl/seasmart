#!/usr/bin/env bash
# Chờ workflow "Desktop build" của commit đang ở HEAD chạy xong, rồi tải 4 bộ cài + build-info vào desktop/dist/installer/.
# Lỗi CI thì in phần log lỗi và thoát 1. Chạy trong repo seasmart:
#   bash .claude/skills/phat-hanh/scripts/ci-artifacts.sh
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
SHA=$(git rev-parse HEAD)
REPO=huyld-axl/seasmart

RUN=""
for _ in $(seq 1 30); do
  RUN=$(gh run list -R "$REPO" --workflow desktop-build.yml --commit "$SHA" --json databaseId --jq '.[0].databaseId // empty')
  [ -n "$RUN" ] && break
  sleep 10
done
[ -n "$RUN" ] || { echo "Không thấy lượt CI Desktop build cho commit ${SHA:0:8} (push có đổi desktop/ chưa?)"; exit 1; }
echo "CI: https://github.com/$REPO/actions/runs/$RUN"

if ! gh run watch "$RUN" -R "$REPO" --exit-status --interval 60 >/dev/null; then
  echo "CI lỗi. Log các bước hỏng:"
  gh run view "$RUN" -R "$REPO" --log-failed | tail -120
  exit 1
fi

OUT="$ROOT/desktop/dist/installer"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
gh run download "$RUN" -R "$REPO" -D "$TMP"
mkdir -p "$OUT"
rm -f "$OUT"/*.deb "$OUT"/*.exe "$OUT"/*.dmg "$OUT"/build-info-*.json
find "$TMP" -type f \( -name '*.deb' -o -name '*.exe' -o -name '*.dmg' -o -name 'build-info-*.json' \) -exec mv {} "$OUT"/ \;

# Mọi bản phải build từ đúng commit vừa push.
for info in "$OUT"/build-info-*.json; do
  commit=$(node -p "require('$info').commit")
  [ "$commit" = "$SHA" ] || { echo "$(basename "$info") build từ ${commit:0:8}, không phải ${SHA:0:8}"; exit 1; }
done
ls -la "$OUT"
