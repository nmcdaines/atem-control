mod legacy;
pub mod postgres;
use control_core::{Config, Error, PanoramaInfo, Result};
pub use legacy::{ImportReport, import_legacy};
use rusqlite::{Connection, OptionalExtension};
use std::path::Path;

/// Owned by one blocking worker in the application runtime.
pub struct Store {
    connection: Connection,
}
fn storage(error: impl std::fmt::Display) -> Error {
    Error::Storage(error.to_string())
}
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let connection = Connection::open(path).map_err(storage)?;
        connection
            .busy_timeout(std::time::Duration::from_secs(5))
            .map_err(storage)?;
        connection.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_config (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS panorama (device_id TEXT PRIMARY KEY, info TEXT NOT NULL, jpeg BLOB NOT NULL);").map_err(storage)?;
        Ok(Self { connection })
    }
    pub fn load(&self) -> Result<Config> {
        let json: Option<String> = self
            .connection
            .query_row("SELECT json FROM app_config WHERE id=1", [], |row| {
                row.get(0)
            })
            .optional()
            .map_err(storage)?;
        let config: Config = match json {
            Some(json) => serde_json::from_str(&json).map_err(storage)?,
            None => Config::default(),
        };
        config.validate()?;
        Ok(config)
    }
    pub fn save(&mut self, config: &Config) -> Result<()> {
        config.validate()?;
        let json = serde_json::to_string(config).map_err(storage)?;
        let tx = self.connection.transaction().map_err(storage)?;
        tx.execute("INSERT INTO app_config (id,version,json) VALUES (1,?1,?2) ON CONFLICT(id) DO UPDATE SET version=excluded.version,json=excluded.json", rusqlite::params![config.version, json]).map_err(storage)?;
        tx.commit().map_err(storage)?;
        Ok(())
    }
    /// Panoramas are kept out of the configuration JSON because of their size.
    pub fn save_panorama(&mut self, info: &PanoramaInfo, jpeg: &[u8]) -> Result<()> {
        let json = serde_json::to_string(info).map_err(storage)?;
        self.connection
            .execute(
                "INSERT INTO panorama (device_id,info,jpeg) VALUES (?1,?2,?3) ON CONFLICT(device_id) DO UPDATE SET info=excluded.info,jpeg=excluded.jpeg",
                rusqlite::params![info.device_id, json, jpeg],
            )
            .map_err(storage)?;
        Ok(())
    }
    pub fn panoramas(&self) -> Result<Vec<PanoramaInfo>> {
        let mut statement = self
            .connection
            .prepare("SELECT info FROM panorama ORDER BY device_id")
            .map_err(storage)?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(storage)?;
        rows.map(|json| serde_json::from_str(&json.map_err(storage)?).map_err(storage))
            .collect()
    }
    pub fn panorama_jpeg(&self, device_id: &str) -> Result<Option<Vec<u8>>> {
        self.connection
            .query_row(
                "SELECT jpeg FROM panorama WHERE device_id=?1",
                [device_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage)
    }
    pub fn delete_panorama(&mut self, device_id: &str) -> Result<()> {
        self.connection
            .execute("DELETE FROM panorama WHERE device_id=?1", [device_id])
            .map_err(storage)?;
        Ok(())
    }
    pub fn backup(&self, destination: &Path) -> Result<()> {
        self.connection
            .backup(rusqlite::MAIN_DB, destination, None)
            .map_err(storage)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stores_panoramas_outside_the_configuration() {
        let temp = tempfile::tempdir().unwrap();
        let mut store = Store::open(&temp.path().join("control.sqlite3")).unwrap();
        let info = PanoramaInfo {
            device_id: "cam".into(),
            width: 4,
            height: 2,
            pan_left: -100.0,
            pan_right: 100.0,
            tilt_top: 50.0,
            tilt_bottom: -50.0,
            tiles: 6,
            created_at: 1,
        };
        store.save_panorama(&info, &[1, 2, 3]).unwrap();
        store.save_panorama(&info, &[4, 5]).unwrap();
        assert_eq!(store.panoramas().unwrap(), vec![info]);
        assert_eq!(store.panorama_jpeg("cam").unwrap(), Some(vec![4, 5]));
        store.delete_panorama("cam").unwrap();
        assert!(store.panoramas().unwrap().is_empty());
        assert_eq!(store.load().unwrap(), Config::default());
    }
    #[test]
    fn persists_on_reopen_and_rejected_save_keeps_previous_configuration() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("control.sqlite3");
        let config = control_core::demo_config();
        let mut store = Store::open(&path).unwrap();
        store.save(&config).unwrap();
        let mut invalid = config.clone();
        invalid.shortcuts[0].macro_id = "missing".into();
        assert!(store.save(&invalid).is_err());
        store.backup(&temp.path().join("backup.sqlite3")).unwrap();
        drop(store);
        assert_eq!(Store::open(&path).unwrap().load().unwrap(), config);
        assert_eq!(
            Store::open(&temp.path().join("backup.sqlite3"))
                .unwrap()
                .load()
                .unwrap(),
            config
        );
    }
}
