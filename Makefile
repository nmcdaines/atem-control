.DEFAULT_GOAL := help

ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
UI := $(ROOT)apps/desktop/ui
API_PORT ?= 3847
UI_PORT ?= 1420
DATABASE ?= $(ROOT).local/control.sqlite3

.PHONY: help setup run desktop dev backend frontend build build-ui types test test-e2e test-postgres check

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; print "ATEM Control\n"} /^[a-zA-Z0-9_-]+:.*## / {printf "  make %-15s %s\n", $$1, $$2}' "$(ROOT)Makefile"

setup: ## Install frontend dependencies and generate shared types
	npm --prefix "$(UI)" ci
	$(MAKE) types

$(UI)/node_modules/.package-lock.json: $(UI)/package.json $(UI)/package-lock.json
	npm --prefix "$(UI)" ci

run: desktop ## Run the native Tauri desktop app (requires platform prerequisites)

desktop: $(UI)/node_modules/.package-lock.json
	npm --prefix "$(UI)" run desktop

dev: $(UI)/node_modules/.package-lock.json ## Run the Rust backend + browser UI together
	CONTROL_API_PORT="$(API_PORT)" CONTROL_UI_PORT="$(UI_PORT)" CONTROL_DATABASE="$(DATABASE)" node "$(ROOT)scripts/dev.mjs"

backend: ## Run only the Rust development API with demo data in an empty workspace
	cd "$(ROOT)" && cargo run -p control-server -- --demo --port "$(API_PORT)" --database "$(DATABASE)"

frontend: $(UI)/node_modules/.package-lock.json ## Run only the browser UI
	VITE_CONTROL_API="http://127.0.0.1:$(API_PORT)" npm --prefix "$(UI)" run dev -- --port "$(UI_PORT)"

build: $(UI)/node_modules/.package-lock.json ## Build native desktop application and installers
	npm --prefix "$(UI)" run tauri -- build

build-ui: $(UI)/node_modules/.package-lock.json ## Build the React interface only
	npm --prefix "$(UI)" run build

types: ## Regenerate TypeScript types from the Rust model
	cd "$(ROOT)" && cargo run -p control-core --bin export-types

test: $(UI)/node_modules/.package-lock.json ## Run Rust and UI unit tests
	cd "$(ROOT)" && cargo test --locked
	npm --prefix "$(UI)" test

test-e2e: $(UI)/node_modules/.package-lock.json ## Run browser workflows (install Playwright Chromium first)
	npm --prefix "$(UI)" run test:e2e

test-postgres: ## Run import integration test against ATEM_TEST_POSTGRES_URL (disposable DB)
	cd "$(ROOT)" && cargo test --locked -p control-storage --test postgres -- --ignored

check: test ## Check formatting, Rust lints and frontend production build
	cd "$(ROOT)" && node --check scripts/dev.mjs
	cd "$(ROOT)" && cargo fmt --all -- --check
	cd "$(ROOT)" && cargo clippy --locked --all-targets -- -D warnings
	npm --prefix "$(UI)" run format:check
	$(MAKE) build-ui
