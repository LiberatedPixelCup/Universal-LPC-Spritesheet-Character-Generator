#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
version=1.0.1
electron_version=45.4.1
archive_name="electron-v${electron_version}-darwin-arm64.zip"
archive_sha=d080c3b05a01bd16137f2c12ab9ebf083c577757fe846844ba325bafa8e8bdf4
archive=${1:-}
output=${2:-"$root/release"}

if [[ $(uname -s) != Darwin || $(uname -m) != arm64 ]]; then
  echo "Run this build on an Apple Silicon Mac." >&2
  exit 1
fi

build_dir=$(mktemp -d "${TMPDIR:-/tmp}/open-spritesheet.XXXXXXXX")
trap 'rm -rf "$build_dir"' EXIT
if [[ -z "$archive" ]]; then
  archive="$build_dir/$archive_name"
  curl --fail --silent --show-error --location --retry 2 \
    "https://github.com/electron/electron/releases/download/v${electron_version}/$archive_name" \
    --output "$archive"
fi
printf '%s  %s\n' "$archive_sha" "$archive" | shasum -a 256 -c -
ditto -x -k "$archive" "$build_dir/runtime"

cd "$root"
npm run build

mkdir "$build_dir/image"
application="$build_dir/image/Open Spritesheet.app"
mv "$build_dir/runtime/Electron.app" "$application"
contents="$application/Contents"
plist="$contents/Info.plist"
resources="$contents/Resources"
app_root="$resources/app"
bundle_id=io.github.teakay1311.OpenSpritesheet
mkdir -p "$app_root/web" "$app_root/Licenses"

rsync -a dist/index.html dist/assets dist/spritesheets "$app_root/web/"
cp LICENSE "$app_root/Licenses/Application-GPL-3.0.txt"
cp macos/LICENSE "$app_root/Licenses/Packaging-Apache-2.0.txt"
cp "$build_dir/runtime/LICENSE" "$app_root/Licenses/Electron.txt"
cp "$build_dir/runtime/LICENSES.chromium.html" "$app_root/Licenses/"
cp CREDITS.csv "$app_root/"
for package in bulma classnames jszip mithril neverthrow tinygesture pako lie immediate readable-stream safe-buffer inherits string_decoder util-deprecate core-util-is isarray process-nextick-args setimmediate; do
  notice_dir="$app_root/Licenses/npm/$package"
  mkdir -p "$notice_dir"
  if [[ "$package" == isarray ]]; then
    cp "node_modules/$package/README.md" "$notice_dir/"
  else
    find -H "node_modules/$package" -maxdepth 1 -type f -iname 'license*' -exec cp {} "$notice_dir/" \;
    [[ -n $(ls -A "$notice_dir") ]] || { echo "Missing license for $package" >&2; exit 1; }
  fi
done

node --input-type=module - "$app_root" "$version" <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import ts from "typescript";

const [target, version] = process.argv.slice(2);
fs.writeFileSync(path.join(target, "main.mjs"), stripTypeScriptTypes(fs.readFileSync("macos/main.ts", "utf8")));

const preloadTs = fs.readFileSync("macos/preload.ts", "utf8");
const preloadCjs = ts.transpileModule(preloadTs, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
fs.writeFileSync(path.join(target, "preload.cjs"), preloadCjs);

fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({
  name: "open-spritesheet",
  productName: "Open Spritesheet",
  version,
  private: true,
  main: "main.mjs",
}, null, 2) + "\n");
NODE

iconset="$build_dir/AppIcon.iconset"
mkdir -p "$iconset"
swift scripts/generate_app_icon.swift "Pixel Chibi Clicker Icon.png" "$iconset"
iconutil -c icns "$iconset" -o "$resources/OpenSpritesheet.icns"

mv "$contents/MacOS/Electron" "$contents/MacOS/Open Spritesheet"
plutil -replace CFBundleExecutable -string "Open Spritesheet" "$plist"
plutil -replace CFBundleName -string "Open Spritesheet" "$plist"
plutil -replace CFBundleDisplayName -string "Open Spritesheet" "$plist"
plutil -replace CFBundleIdentifier -string "$bundle_id" "$plist"
plutil -replace CFBundleIconFile -string OpenSpritesheet.icns "$plist"
plutil -replace CFBundleShortVersionString -string "$version" "$plist"
plutil -replace CFBundleVersion -string "$version" "$plist"
rm -f "$resources/default_app.asar" "$resources/electron.icns"

codesign --force --deep --sign - "$application"
codesign --verify --deep --strict "$application"
ln -s /Applications "$build_dir/image/Applications"

filename="OpenSpritesheet-$version-mac-arm64.dmg"
hdiutil create -volname "Open Spritesheet" -srcfolder "$build_dir/image" \
  -format UDZO "$build_dir/$filename"
hdiutil verify "$build_dir/$filename"
mkdir -p "$output"
mv "$build_dir/$filename" "$output/"
(cd "$output" && shasum -a 256 "$filename" > "$filename.sha256")
printf 'Created %s/%s\n' "$output" "$filename"
