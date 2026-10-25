use control_core::*;
use control_runtime::Controller;
use std::time::Duration;

async fn app() -> (tempfile::TempDir, std::sync::Arc<Controller>) {
    let directory = tempfile::tempdir().unwrap();
    let app = Controller::open(directory.path().join("test.sqlite3"))
        .await
        .unwrap();
    app.save_config(demo_config()).await.unwrap();
    (directory, app)
}
async fn finish(app: &Controller) -> Run {
    for _ in 0..1000 {
        let snapshot = app.snapshot().await;
        if snapshot.runs[0].status != RunStatus::Running {
            return snapshot.runs[0].clone();
        }
        tokio::task::yield_now().await;
    }
    panic!("Macro did not terminate")
}

#[tokio::test]
async fn delay_prevents_cut_until_wait_finishes_and_order_is_preserved() {
    let (_dir, app) = app().await;
    tokio::time::pause();
    app.execute("demo-atem", Command::SetProgram { input: 4 })
        .await
        .unwrap();
    app.run_macro("demo-shot").await.unwrap();
    for _ in 0..20 {
        tokio::task::yield_now().await;
    }
    let before = app.snapshot().await;
    assert_eq!(before.devices[0].switcher.as_ref().unwrap().program, 4);
    tokio::time::advance(Duration::from_millis(499)).await;
    assert_eq!(
        app.snapshot().await.devices[0]
            .switcher
            .as_ref()
            .unwrap()
            .program,
        4
    );
    tokio::time::advance(Duration::from_millis(2)).await;
    assert_eq!(finish(&app).await.status, RunStatus::Completed);
    assert_eq!(
        app.snapshot().await.devices[0]
            .switcher
            .as_ref()
            .unwrap()
            .program,
        1
    );
}

#[tokio::test]
async fn cancelling_wait_prevents_later_hardware_actions_and_releases_run() {
    let (_dir, app) = app().await;
    let mut config = demo_config();
    config.macros[0]
        .steps
        .insert(0, Step::Wait { duration_ms: 60000 });
    app.save_config(config.clone()).await.unwrap();
    app.execute("demo-atem", Command::SetProgram { input: 4 })
        .await
        .unwrap();
    let id = app.run_macro("demo-shot").await.unwrap();
    assert!(matches!(
        app.execute("demo-atem", Command::Cut).await,
        Err(Error::Busy)
    ));
    assert!(app.save_config(config).await.is_err());
    assert!(app.run_macro("demo-shot").await.is_err());
    app.cancel(&id).await.unwrap();
    assert_eq!(finish(&app).await.status, RunStatus::Cancelled);
    assert_eq!(
        app.snapshot().await.devices[0]
            .switcher
            .as_ref()
            .unwrap()
            .program,
        4
    );
    app.execute("demo-atem", Command::Cut).await.unwrap();
}

#[tokio::test]
async fn preflight_rejects_unavailable_transport_before_any_step_runs() {
    let (_dir, app) = app().await;
    let mut config = demo_config();
    config.devices[0].connection = Connection::Atem {
        address: "127.0.0.1".into(),
    };
    app.save_config(config).await.unwrap();
    assert!(app.run_macro("demo-shot").await.is_err());
    assert_eq!(
        app.snapshot().await.devices[1].camera.as_ref().unwrap().pan,
        0
    );
    assert!(app.snapshot().await.runs.is_empty());
}

#[tokio::test]
async fn parallel_group_waits_for_every_device_before_the_next_step() {
    let (_dir, app) = app().await;
    let mut config = demo_config();
    config.macros[0].steps = vec![
        Step::Parallel {
            actions: vec![
                Action {
                    device_id: "demo-atem".into(),
                    command: Command::SetPreview { input: 4 },
                    delay_ms: 0,
                    timeout_ms: 5000,
                },
                Action {
                    device_id: "demo-camera".into(),
                    command: Command::Zoom { position: 100 },
                    delay_ms: 500,
                    timeout_ms: 5000,
                },
            ],
        },
        Step::Action {
            action: Action {
                device_id: "demo-atem".into(),
                command: Command::Cut,
                delay_ms: 0,
                timeout_ms: 5000,
            },
        },
    ];
    app.save_config(config).await.unwrap();
    tokio::time::pause();
    app.run_macro("demo-shot").await.unwrap();
    for _ in 0..20 {
        tokio::task::yield_now().await;
    }
    let before = app.snapshot().await;
    assert_eq!(before.devices[0].switcher.as_ref().unwrap().preview, 4);
    assert_eq!(before.devices[0].switcher.as_ref().unwrap().program, 1);
    assert_eq!(before.devices[1].camera.as_ref().unwrap().zoom, 0);
    tokio::time::advance(Duration::from_millis(501)).await;
    assert_eq!(finish(&app).await.status, RunStatus::Completed);
    let after = app.snapshot().await;
    assert_eq!(after.devices[0].switcher.as_ref().unwrap().program, 4);
    assert_eq!(after.devices[1].camera.as_ref().unwrap().zoom, 100);
}
