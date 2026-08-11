#!/bin/sh
set -eu

codex_directory=${CODEX_HOME:-"${HOME}/.codex"}
target_directory="${codex_directory}/skills/mail-agent"

if [ ! -e "${target_directory}" ]; then
  echo "mail-agent skill is not installed at ${target_directory}"
  exit 0
fi

trash_directory="${HOME}/.Trash"
backup_name="mail-agent-uninstalled-$(date +%Y%m%d-%H%M%S)"
mkdir -p "${trash_directory}"
mv "${target_directory}" "${trash_directory}/${backup_name}"
echo "Moved mail-agent skill to ${trash_directory}/${backup_name}"
