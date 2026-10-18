#!/usr/bin/env bash
# Run on macOS with Xcode installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run mobile:sync
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath "$ROOT/mobile/release/PitchIntel.xcarchive" archive
xcodebuild -exportArchive -archivePath "$ROOT/mobile/release/PitchIntel.xcarchive" -exportPath "$ROOT/mobile/release/ios" -exportOptionsPlist "$ROOT/mobile/ExportOptions.plist"
echo "IPA exported to mobile/release/ios/"
