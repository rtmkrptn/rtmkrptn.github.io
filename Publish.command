#!/bin/zsh
#
# Double-click this file to publish every article marked `publish: true` in the
# vault. There is a copy of it on the Desktop; both are the same file, so
# editing this one changes both.
#
# It opens a Terminal window, runs the publish, and waits for a keypress so you
# can read the result before the window closes.

# ${0:A} is the fully resolved path of this file with symlinks followed, so the
# Desktop shortcut lands in the website folder rather than on the Desktop.
cd "${0:A:h}" || exit 1

# Finder launches this without a login shell, so Homebrew's node is not yet on
# PATH. Add the usual locations before anything tries to run npm.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH."
  echo "Install Node, or edit the PATH line in this file to point at it."
elif [[ $# -gt 0 ]]; then
  npm run publish -- "$@"   # lets the shortcut be run with --dry-run etc.
else
  npm run publish
fi

echo
echo "Press any key to close this window."
read -r -k 1 -s
