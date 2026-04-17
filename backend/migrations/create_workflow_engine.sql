-- Phase 3: Workflow Automation Engine
-- Full rule-based workflow system with triggers, conditions, and multi-step actions

-- 1. Workflows table (master workflow definition)
CREATE TABLE IF NOT EXISTS workflows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Workflow triggers (what event fires the workflow)
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  entity_type VARCHAR(50) NOT NULL COMMENT 'candidate, job, interview',
  event_type VARCHAR(50) NOT NULL COMMENT 'stage_change, created, updated, interview_scheduled, task_completed',
  config JSON COMMENT 'e.g. {"from_stage": "Applied", "to_stage": "Interview"}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_event (entity_type, event_type),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Workflow conditions (IF logic)
CREATE TABLE IF NOT EXISTS workflow_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  field VARCHAR(100) NOT NULL COMMENT 'e.g. experience, stage, position, source',
  operator VARCHAR(20) NOT NULL COMMENT '=, !=, >, <, >=, <=, contains, not_contains',
  value VARCHAR(500) NOT NULL,
  logic_group VARCHAR(10) NOT NULL DEFAULT 'AND' COMMENT 'AND or OR',
  condition_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workflow_id (workflow_id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Workflow actions (THEN steps)
CREATE TABLE IF NOT EXISTS workflow_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  action_type VARCHAR(50) NOT NULL COMMENT 'email, task, interview, webhook, stage_change',
  config JSON NOT NULL COMMENT 'Action-specific configuration',
  execution_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_execution_order (execution_order),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Workflow execution logs
CREATE TABLE IF NOT EXISTS workflow_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id INT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  status ENUM('success', 'failure', 'skipped') NOT NULL,
  message TEXT,
  actions_executed INT DEFAULT 0,
  execution_time_ms INT DEFAULT 0,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
