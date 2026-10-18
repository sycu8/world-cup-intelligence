#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

KEYSTORE="${KEYSTORE:-mobile/release/pitchintel-release.keystore}"
PROPS="${PROPS:-android/keystore.properties}"

mkdir -p mobile/release

if [[ ! -f "$KEYSTORE" ]]; then
  echo "Creating release keystore at $KEYSTORE"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias pitchintel \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "${KEYSTORE_PASSWORD:-pitchintel-store}" \
    -keypass "${KEY_PASSWORD:-pitchintel-key}" \
    -dname "CN=PitchIntel, OU=Mobile, O=Orange Cloud, L=Ho Chi Minh, ST=HCMC, C=VN"
fi

if [[ ! -f "$PROPS" ]]; then
  cat > "$PROPS" <<EOF
storeFile=../../mobile/release/pitchintel-release.keystore
storePassword=${KEYSTORE_PASSWORD:-pitchintel-store}
keyAlias=pitchintel
keyPassword=${KEYSTORE_PASSWORD:-pitchintel-store}
EOF
  echo "Wrote $PROPS — customize passwords before Play Console upload."
fi

npm run mobile:sync
cd android
./gradlew bundleRelease
echo "Release AAB: android/app/build/outputs/bundle/release/app-release.aab"
