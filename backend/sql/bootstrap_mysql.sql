CREATE DATABASE IF NOT EXISTS robotic_web_app
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE robotic_web_app;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
) ENGINE=InnoDB;

CREATE TABLE algorithms (
    id INTEGER NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    instrument VARCHAR(64) NOT NULL,
    resolution VARCHAR(64) NOT NULL,
    is_active BOOL,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    UNIQUE (code)
) ENGINE=InnoDB;

CREATE INDEX ix_algorithms_id ON algorithms (id);

CREATE TABLE training_models (
    id INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    optimizer VARCHAR(128),
    trial_count INTEGER,
    parameter_ranges_json JSON,
    config_json JSON,
    is_active BOOL,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    UNIQUE (`key`)
) ENGINE=InnoDB;

CREATE INDEX ix_training_models_id ON training_models (id);

CREATE TABLE admin_options (
    id INTEGER NOT NULL AUTO_INCREMENT,
    option_type VARCHAR(64) NOT NULL,
    value VARCHAR(128) NOT NULL,
    is_active BOOL,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    CONSTRAINT uq_admin_option_type_value UNIQUE (option_type, value)
) ENGINE=InnoDB;

CREATE INDEX ix_admin_options_id ON admin_options (id);

CREATE TABLE algorithm_versions (
    id INTEGER NOT NULL AUTO_INCREMENT,
    algo_id INTEGER NOT NULL,
    version_label VARCHAR(128) NOT NULL,
    description TEXT,
    parameter_set_json JSON NOT NULL,
    git_commit_sha VARCHAR(128),
    github_repo_owner VARCHAR(128),
    github_repo_name VARCHAR(128),
    github_parameter_path VARCHAR(512),
    github_ref VARCHAR(256),
    effective_from DATETIME,
    is_current BOOL,
    is_active BOOL NOT NULL DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (algo_id) REFERENCES algorithms (id)
) ENGINE=InnoDB;

CREATE INDEX ix_algorithm_versions_id ON algorithm_versions (id);

CREATE TABLE training_results (
    id INTEGER NOT NULL AUTO_INCREMENT,
    algo_version_id INTEGER NOT NULL,
    model_id INTEGER,
    run_source VARCHAR(64) NOT NULL,
    comments TEXT,
    status VARCHAR(64) NOT NULL,
    run_started_at DATETIME,
    run_completed_at DATETIME,
    data_from DATETIME,
    data_to DATETIME,
    summary_json JSON,
    chart_series_json JSON,
    s3_prefix VARCHAR(512),
    is_dashboard_latest BOOL NOT NULL DEFAULT FALSE,
    created_at DATETIME,
    updated_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (algo_version_id) REFERENCES algorithm_versions (id),
    FOREIGN KEY (model_id) REFERENCES training_models (id)
) ENGINE=InnoDB;

CREATE INDEX ix_training_results_id ON training_results (id);
CREATE INDEX ix_training_results_is_dashboard_latest
    ON training_results (is_dashboard_latest);

CREATE TABLE training_result_versions (
    id INTEGER NOT NULL AUTO_INCREMENT,
    result_id INTEGER NOT NULL,
    algo_version_id INTEGER NOT NULL,
    created_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (result_id) REFERENCES training_results (id),
    FOREIGN KEY (algo_version_id) REFERENCES algorithm_versions (id),
    CONSTRAINT uq_training_result_version UNIQUE (result_id, algo_version_id)
) ENGINE=InnoDB;

CREATE INDEX ix_training_result_versions_id ON training_result_versions (id);

CREATE TABLE training_artifacts (
    id INTEGER NOT NULL AUTO_INCREMENT,
    result_id INTEGER NOT NULL,
    artifact_type VARCHAR(64) NOT NULL,
    file_name VARCHAR(256) NOT NULL,
    s3_key VARCHAR(1024) NOT NULL,
    content_type VARCHAR(128) NOT NULL,
    byte_size INTEGER,
    checksum_sha256 VARCHAR(128),
    created_at DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (result_id) REFERENCES training_results (id)
) ENGINE=InnoDB;

CREATE INDEX ix_training_artifacts_id ON training_artifacts (id);

INSERT INTO alembic_version (version_num)
VALUES ('0005_training_result_dashboard_latest');

INSERT INTO admin_options (
    option_type,
    value,
    is_active,
    created_at,
    updated_at
)
VALUES
    ('instrument', 'EURUSD', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('instrument', 'BTCUSD', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('instrument', 'AAPL', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('instrument', 'ETHUSD', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('instrument', 'GOLD', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', '1m', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', '5m', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', '15m', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', '1h', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', '1d', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
    ('resolution', 'MINUTE_15', TRUE, UTC_TIMESTAMP(), UTC_TIMESTAMP());
