# Upgrading to Montask

The application, emails, translations, binaries and release bundles now use
Montask. Migration 000063 updates the previous default brand, default namespace,
SMTP sender name and reserved namespace list. Customized values are preserved.
Browser login, preferences and session navigation are automatically moved to
the `montask_` storage keys before the application reads them.

Keep your existing `.env` when upgrading. In particular, keep
`COMPOSE_PROJECT_NAME`, `POSTGRES_USER`, `POSTGRES_DB`, `MINIO_ROOT_USER`,
`MINIO_BUCKET`, `STORAGE_BUCKET`, and the encryption secrets: these identify
existing volumes, accounts and stored data. The new `.env.template` uses
Montask defaults for fresh installations. Rebuild your local images with
`docker compose build` before restarting the services.

Existing backups containing `db/taskwondo.dump` are still importable. New
exports contain `db/montask.dump`. MCP accepts both `MONTASK_*` and the previous
`TASKWONDO_*` variables; Montask values take precedence.

Compatibility identifiers intentionally retain their original values:

- The encryption key derivation salt, OAuth synthetic email domain and API key
  prefix preserve access to existing secrets, accounts and integrations.
- NATS stream and subject names preserve queued jobs.
- Prometheus metric names preserve existing dashboards and alerts.
- The default storage bucket in the API remains compatible with older setups;
  fresh Compose installations explicitly configure the Montask bucket.
- GitHub links, Go module paths and GHCR image locations still identify the
  upstream repository. They can be changed once replacement locations exist.

The screenshots are historical captures; their filenames now use Montask.
