#!/bin/zsh
#
# Double-click this file in Finder to publish every article marked
# `publish: true` in the vault. Drag it to the Dock to keep it one click away.
#
# It opens a Terminal window, runs the publish script, and waits for a keypress
# so you can read the result before the window closes.

cd "$(dirname "$0")" || exit 1

# Finder launches this without a login shell, so Homebrew's node is not yet on
# PATH. Add the usual locations before anything tries to run npm.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH."
  echo "Install Node, or edit the PATH line in this file to point at it."
else
  npm run publish
fi

echo
echo "Press any key to close this window."
read -r -k 1 -s
