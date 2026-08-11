#!/bin/sh
set -eu

project_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
codex_directory=${CODEX_HOME:-"${HOME}/.codex"}
skills_directory="${codex_directory}/skills"
target_directory="${skills_directory}/mail-agent"

if [ -e "${target_directory}" ]; then
  echo "Refusing to overwrite existing ${target_directory}" >&2
  exit 1
fi

mkdir -p "${skills_directory}"
cp -R "${project_directory}/skills/mail-agent" "${target_directory}"
echo "Installed mail-agent skill at ${target_directory}"
