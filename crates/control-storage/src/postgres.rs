//! Read a consistent snapshot of the Docker branch's TypeORM tables.
//! Credentials are transient and never returned or stored in SQLite.
use crate::{ImportReport, import_legacy};
use control_core::{Error, PostgresImportSettings, Result};
use serde_json::Value;
use std::time::Duration;
use tokio_postgres::{Client, IsolationLevel, NoTls, Transaction, config::SslMode};

const MAX_BYTES: usize = 2 * 1024 * 1024;

pub fn validate_settings(settings: &PostgresImportSettings) -> Result<()> {
    if settings.host.trim().is_empty()
        || settings.host.len() > 253
        || settings.host.contains(['\0', '/', '\\'])
        || settings.port == 0
        || settings.database.is_empty()
        || settings.database.len() > 63
        || settings.username.is_empty()
        || settings.username.len() > 63
        || settings.schema.is_empty()
        || settings.schema.len() > 63
        || [
            &settings.host,
            &settings.database,
            &settings.username,
            &settings.schema,
            &settings.password,
        ]
        .iter()
        .any(|s| s.contains('\0'))
        || settings.password.len() > 4096
    {
        return Err(Error::Invalid("Enter a host, port, database, username and schema. PostgreSQL names must be at most 63 bytes; the host must be a hostname or IP address.".into()));
    }
    Ok(())
}

// Never echo server-generated text: it may contain credentials or parameters.
fn database_error(error: tokio_postgres::Error) -> Error {
    let message = match error.code().map(|code| code.code()) {
        Some("28P01" | "28000") => {
            "PostgreSQL authentication failed. Check the username, password and server access rules."
        }
        Some("3D000") => "PostgreSQL database not found. The Docker branch uses nestjs by default.",
        Some("42501") => "The PostgreSQL account needs SELECT access to the legacy tables.",
        Some("42P01" | "3F000" | "42703") => {
            "Legacy tables or columns were not found in that schema. Expected the Docker branch's device, macro and shortcut tables."
        }
        Some("57014" | "55P03") => {
            "Reading PostgreSQL timed out or a table was locked. Try again when the database is available."
        }
        _ if error.is_closed() => "The PostgreSQL connection closed before the snapshot finished.",
        _ => "Could not read PostgreSQL. Check the host, port, network access and TLS settings.",
    };
    Error::Storage(message.into())
}

fn table_query(schema: &str, table: &str, columns: &str, order: &str, limit: usize) -> String {
    // Only schema is user-supplied. Doubling quotes makes it one identifier.
    let schema = schema.replace('"', "\"\"");
    format!(
        "SELECT CASE WHEN sum(octet_length(row_to_json(source)::text)) OVER () <= $1 THEN row_to_json(source)::text END FROM (SELECT {columns} FROM \"{schema}\".\"{table}\" ORDER BY {order} LIMIT {}) AS source",
        limit + 1
    )
}

async fn read_table(
    transaction: &Transaction<'_>,
    query: &str,
    limit: usize,
    remaining: &mut usize,
) -> Result<Vec<Value>> {
    let rows = transaction
        .query(query, &[&(*remaining as i64)])
        .await
        .map_err(database_error)?;
    if rows.len() > limit {
        return Err(Error::Invalid("The PostgreSQL workspace exceeds the supported number of devices, macros or shortcuts.".into()));
    }
    let mut values = Vec::with_capacity(rows.len());
    for row in rows {
        let json: Option<String> = row.try_get(0).map_err(database_error)?;
        let json = json.ok_or_else(|| {
            Error::Invalid("The PostgreSQL workspace exceeds the 2 MB import limit.".into())
        })?;
        if json.len() > *remaining {
            return Err(Error::Invalid(
                "The PostgreSQL workspace exceeds the 2 MB import limit.".into(),
            ));
        }
        *remaining -= json.len();
        values.push(
            serde_json::from_str(&json)
                .map_err(|_| Error::Invalid("PostgreSQL returned invalid legacy JSON.".into()))?,
        );
    }
    Ok(values)
}

async fn snapshot(client: &mut Client, schema: &str) -> Result<ImportReport> {
    let transaction = client
        .build_transaction()
        .isolation_level(IsolationLevel::RepeatableRead)
        .read_only(true)
        .start()
        .await
        .map_err(database_error)?;
    transaction.batch_execute("SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '3s'; SET LOCAL idle_in_transaction_session_timeout = '15s';").await.map_err(database_error)?;
    let mut remaining = MAX_BYTES;
    let devices = read_table(
        &transaction,
        &table_query(schema, "device", "id, \"ipAddress\", name, type", "id", 64),
        64,
        &mut remaining,
    )
    .await?;
    let macros = read_table(
        &transaction,
        &table_query(
            schema,
            "macro",
            "id, name, description, device, steps, type",
            "id",
            1000,
        ),
        1000,
        &mut remaining,
    )
    .await?;
    let shortcuts = read_table(
        &transaction,
        &table_query(
            schema,
            "shortcut",
            "id, page, slot, command, value",
            "page, slot, id",
            1000,
        ),
        1000,
        &mut remaining,
    )
    .await?;
    let json = serde_json::to_string(
        &serde_json::json!({ "devices": devices, "macros": macros, "shortcuts": shortcuts }),
    )
    .map_err(|_| Error::Invalid("Unable to encode the legacy workspace.".into()))?;
    if json.len() > MAX_BYTES {
        return Err(Error::Invalid(
            "The PostgreSQL workspace exceeds the 2 MB import limit.".into(),
        ));
    }
    let mut report = import_legacy(&json)?;
    transaction.commit().await.map_err(database_error)?;
    report.warnings.insert(0, "Read-only PostgreSQL snapshot. Applying this preview replaces the local workspace after creating a backup; it does not modify PostgreSQL.".into());
    Ok(report)
}

pub async fn preview(settings: PostgresImportSettings) -> Result<ImportReport> {
    validate_settings(&settings)?;
    tokio::time::timeout(Duration::from_secs(30), async {
        let mut config = tokio_postgres::Config::new();
        config.host(&settings.host).port(settings.port).dbname(&settings.database).user(&settings.username).password(&settings.password).application_name("atem-control-import").connect_timeout(Duration::from_secs(5));
        if settings.require_tls {
            config.ssl_mode(SslMode::Require);
            let native = rustls_native_certs::load_native_certs();
            let mut roots = rustls::RootCertStore::empty();
            roots.add_parsable_certificates(native.certs);
            if roots.is_empty() { return Err(Error::Storage("No system certificate authorities are available for PostgreSQL TLS verification.".into())); }
            let tls = rustls::ClientConfig::builder_with_provider(std::sync::Arc::new(rustls::crypto::ring::default_provider())).with_safe_default_protocol_versions().map_err(|_| Error::Storage("Unable to configure PostgreSQL TLS.".into()))?.with_root_certificates(roots).with_no_client_auth();
            let (mut client, connection) = config.connect(tokio_postgres_rustls::MakeRustlsConnect::new(tls)).await.map_err(database_error)?;
            let connection = tokio::spawn(async move { let _ = connection.await; });
            let _abort_on_drop = AbortConnection(connection.abort_handle());
            snapshot(&mut client, &settings.schema).await
        } else {
            config.ssl_mode(SslMode::Disable);
            let (mut client, connection) = config.connect(NoTls).await.map_err(database_error)?;
            let connection = tokio::spawn(async move { let _ = connection.await; });
            let _abort_on_drop = AbortConnection(connection.abort_handle());
            snapshot(&mut client, &settings.schema).await
        }
    }).await.map_err(|_| Error::Storage("PostgreSQL import timed out. No local workspace changes were made.".into()))?
}
struct AbortConnection(tokio::task::AbortHandle);
impl Drop for AbortConnection {
    fn drop(&mut self) {
        self.0.abort();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn settings() -> PostgresImportSettings {
        PostgresImportSettings {
            host: "localhost".into(),
            port: 5432,
            database: "nestjs".into(),
            username: "postgres".into(),
            password: "not-persisted".into(),
            schema: "public".into(),
            require_tls: false,
        }
    }
    #[test]
    fn validates_connection_fields_without_echoing_credentials() {
        let mut value = settings();
        value.port = 0;
        assert!(
            !validate_settings(&value)
                .unwrap_err()
                .to_string()
                .contains("not-persisted")
        );
        value.port = 5432;
        assert!(validate_settings(&value).is_ok());
        value.schema = "bad\0schema".into();
        assert!(validate_settings(&value).is_err());
    }
    #[test]
    fn quotes_schema_as_one_identifier() {
        assert!(
            table_query("a\"; DROP TABLE device;--", "device", "id", "id", 64)
                .contains("FROM \"a\"\"; DROP TABLE device;--\".\"device\" ORDER BY id LIMIT 65")
        );
    }
}
