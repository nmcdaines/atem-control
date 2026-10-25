//! Runs against a disposable PostgreSQL database, never the user's source DB.
use control_core::{PostgresImportSettings, Step};
use control_storage::postgres;
use tokio_postgres::NoTls;

#[tokio::test]
#[ignore = "requires ATEM_TEST_POSTGRES_URL pointing to a disposable PostgreSQL database"]
async fn reads_docker_schema_with_read_only_account_and_preserves_source() {
    let url = std::env::var("ATEM_TEST_POSTGRES_URL")
        .expect("Set ATEM_TEST_POSTGRES_URL to a disposable database");
    let admin_config: tokio_postgres::Config = url.parse().unwrap();
    let (admin, connection) = admin_config.connect(NoTls).await.unwrap();
    let connection = tokio::spawn(async move {
        let _ = connection.await;
    });
    let schema = format!("atem_import_{}", std::process::id());
    let reader = format!("atem_reader_{}", std::process::id());
    admin.batch_execute(&format!(r#"
        CREATE SCHEMA "{schema}";
        CREATE ROLE "{reader}" LOGIN PASSWORD 'import-test-only';
        CREATE TABLE "{schema}".device (id uuid PRIMARY KEY, "ipAddress" varchar NOT NULL, name varchar NOT NULL, type varchar);
        CREATE TABLE "{schema}".macro (id uuid PRIMARY KEY, name varchar NOT NULL, description varchar, steps jsonb NOT NULL, device varchar NOT NULL, type varchar);
        CREATE TABLE "{schema}".shortcut (id uuid PRIMARY KEY, page integer NOT NULL, slot integer NOT NULL, command varchar NOT NULL, value varchar NOT NULL);
        INSERT INTO "{schema}".device VALUES ('00000000-0000-0000-0000-000000000001','127.0.0.1','Docker ATEM','atem'),('00000000-0000-0000-0000-000000000002','127.0.0.1','Docker camera','birddog');
        INSERT INTO "{schema}".macro VALUES ('00000000-0000-0000-0000-000000000003','Docker preset',NULL,'[{{"command":"VISCA_SET_ZOOM","properties":{{"zoom":256}},"delay":300,"order":7}}]','00000000-0000-0000-0000-000000000002','camera');
        INSERT INTO "{schema}".shortcut VALUES ('00000000-0000-0000-0000-000000000004',2,3,'MACRO','00000000-0000-0000-0000-000000000003');
        GRANT USAGE ON SCHEMA "{schema}" TO "{reader}";
        GRANT SELECT ON ALL TABLES IN SCHEMA "{schema}" TO "{reader}";
    "#)).await.unwrap();
    let host = match &admin_config.get_hosts()[0] {
        tokio_postgres::config::Host::Tcp(host) => host.clone(),
        _ => panic!("Use a TCP URL for this test"),
    };
    let make_settings = || PostgresImportSettings {
        host: host.clone(),
        port: admin_config.get_ports().first().copied().unwrap_or(5432),
        database: admin_config.get_dbname().unwrap().into(),
        username: reader.clone(),
        password: "import-test-only".into(),
        schema: schema.clone(),
        require_tls: false,
    };
    let report = postgres::preview(make_settings()).await.unwrap();
    assert_eq!(report.config.devices.len(), 2);
    assert_eq!(report.config.macros[0].name, "Docker preset");
    let Step::LegacyParallel { actions } = &report.config.macros[0].steps[0] else {
        panic!()
    };
    assert_eq!(actions[0].device_id, "00000000-0000-0000-0000-000000000002");
    assert_eq!(actions[0].delay_ms, 0);
    assert_eq!(report.config.shortcuts[0].page, 2);
    assert!(
        !serde_json::to_string(&report)
            .unwrap()
            .contains("import-test-only")
    );
    let source_steps: String = admin
        .query_one(&format!("SELECT steps::text FROM \"{schema}\".macro"), &[])
        .await
        .unwrap()
        .get(0);
    assert!(source_steps.contains("300")); // Original delay was not rewritten.
    // A view exposes the transaction settings used by the importer, verifying
    // the snapshot contract independently of the reader's SELECT-only grants.
    admin.batch_execute(&format!(r#"
        ALTER TABLE "{schema}".device RENAME TO device_rows;
        CREATE VIEW "{schema}".device AS SELECT id, "ipAddress", CASE WHEN current_setting('transaction_read_only') = 'on' AND current_setting('transaction_isolation') = 'repeatable read' THEN name ELSE 'invalid snapshot' END AS name, type FROM "{schema}".device_rows;
        GRANT SELECT ON "{schema}".device TO "{reader}";
    "#)).await.unwrap();
    let verified = postgres::preview(make_settings()).await.unwrap();
    assert_eq!(verified.config.devices[0].name, "Docker ATEM");
    let mut bad_user = make_settings();
    bad_user.username = format!("missing_{}", std::process::id());
    let error = postgres::preview(bad_user).await.err().unwrap().to_string();
    assert!(error.contains("authentication"));
    assert!(!error.contains("import-test-only"));
    let mut missing = make_settings();
    missing.schema = "missing_schema".into();
    assert!(
        postgres::preview(missing)
            .await
            .err()
            .unwrap()
            .to_string()
            .contains("tables or columns")
    );
    admin.batch_execute(&format!("UPDATE \"{schema}\".macro SET steps = '[{{\"command\":\"UNKNOWN_COMMAND\",\"properties\":{{}}}}]'::jsonb")).await.unwrap();
    let error = postgres::preview(make_settings())
        .await
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("UNKNOWN_COMMAND"));
    admin
        .batch_execute(&format!(
            "UPDATE \"{schema}\".macro SET description = repeat('x', 2097153)"
        ))
        .await
        .unwrap();
    assert!(
        postgres::preview(make_settings())
            .await
            .err()
            .unwrap()
            .to_string()
            .contains("2 MB")
    );
    assert_eq!(
        admin
            .query_one(&format!("SELECT count(*) FROM \"{schema}\".device"), &[])
            .await
            .unwrap()
            .get::<_, i64>(0),
        2
    );
    admin
        .batch_execute(&format!(
            "DROP SCHEMA \"{schema}\" CASCADE; DROP ROLE \"{reader}\";"
        ))
        .await
        .unwrap();
    drop(admin);
    connection.await.unwrap();
}
