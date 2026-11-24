#!/bin/sh
set -e

# If running as root (initial container entry on Railway or host with volume mount),
# ensure the /data volume is owned and writable by the unprivileged appuser (UID 1000)
# so SQLite can create and write app.db, app.db-wal, and app.db-shm.
if [ "$(id -u)" = "0" ]; then
    if [ -d "/data" ]; then
        chown -R appuser:appgroup /data 2>/dev/null || true
        chmod 775 /data 2>/dev/null || true
    fi
    # Drop privileges to appuser before executing application command
    exec runuser -u appuser -- "$@"
else
    # Already running as unprivileged user
    exec "$@"
fi
