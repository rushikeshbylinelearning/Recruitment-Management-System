-- Phase 2: Pipeline Intelligence Database Schema
-- This migration adds tables and columns for automated pipeline management

-- 1. Extend candidates table with stage tracking
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS previous_stage VARCHAR(50) AFTER stage,
ADD COLUMN IF NOT EXISTS stage_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER previous_stage,
ADD INDEX idx_stage (stage),
ADD INDEX idx_stage_updated_at (stage_updated_at);

-- 2. Create activity_logs table for comprehensive tracking
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL COMMENT 'candidate, job, interview, etc.',
  entity_id INT NOT NULL COMMENT 'ID of the entity',
  action_type VARCHAR(100) NOT NULL COMMENT 'stage_change, email_sent, task_created, etc.',
  description TEXT NOT NULL COMMENT 'Human-readable description',
  metadata JSON COMMENT 'Additional data about the action',
  created_by INT COMMENT 'User who triggered the action',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create pipeline_automations table
CREATE TABLE IF NOT EXISTS pipeline_automations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Automation name',
  description TEXT COMMENT 'What this automation does',
  trigger_stage VARCHAR(50) NOT NULL COMMENT 'Stage that triggers this automation',
  trigger_event VARCHAR(50) NOT NULL DEFAULT 'on_enter' COMMENT 'on_enter or on_exit',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether automation is enabled',
  priority INT DEFAULT 0 COMMENT 'Execution order (higher = first)',
  created_by INT COMMENT 'User who created this automation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_trigger (trigger_stage, trigger_event, is_active),
  INDEX idx_priority (priority),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create automation_actions table
CREATE TABLE IF NOT EXISTS automation_actions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  automation_id INT NOT NULL COMMENT 'Parent automation',
  action_type VARCHAR(50) NOT NULL COMMENT 'email, task, interview, webhook, etc.',
  action_order INT DEFAULT 0 COMMENT 'Execution sequence',
  config JSON NOT NULL COMMENT 'Action configuration',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether action is enabled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_automation (automation_id, action_order),
  FOREIGN KEY (automation_id) REFERENCES pipeline_automations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create pipeline_rules table for validation
CREATE TABLE IF NOT EXISTS pipeline_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Rule name',
  rule_type VARCHAR(50) NOT NULL COMMENT 'stage_transition, validation, etc.',
  config JSON NOT NULL COMMENT 'Rule configuration',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether rule is enabled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rule_type (rule_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create automation_execution_log for debugging
CREATE TABLE IF NOT EXISTS automation_execution_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  automation_id INT NOT NULL COMMENT 'Automation that was executed',
  action_id INT COMMENT 'Specific action that was executed',
  entity_type VARCHAR(50) NOT NULL COMMENT 'candidate, etc.',
  entity_id INT NOT NULL COMMENT 'ID of the entity',
  status VARCHAR(50) NOT NULL COMMENT 'success, failed, skipped',
  error_message TEXT COMMENT 'Error details if failed',
  execution_time_ms INT COMMENT 'How long it took',
  metadata JSON COMMENT 'Additional execution data',
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_automation (automation_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_status (status),
  INDEX idx_executed_at (executed_at),
  FOREIGN KEY (automation_id) REFERENCES pipeline_automations(id) ON DELETE CASCADE,
  FOREIGN KEY (action_id) REFERENCES automation_actions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default automations (examples)
INSERT INTO pipeline_automations (name, description, trigger_stage, trigger_event, is_active, priority) VALUES
('Welcome Email on Application', 'Send welcome email when candidate applies', 'Applied', 'on_enter', TRUE, 10),
('Schedule Screening on Screening Stage', 'Create task to schedule screening call', 'Screening', 'on_enter', TRUE, 10),
('Interview Notification', 'Send interview details to candidate', 'Interview', 'on_enter', TRUE, 10),
('Offer Letter Preparation', 'Create task to prepare offer letter', 'Offer', 'on_enter', TRUE, 10);

-- Insert default automation actions
-- Action 1: Welcome Email
INSERT INTO automation_actions (automation_id, action_type, action_order, config) VALUES
(1, 'email', 1, JSON_OBJECT(
  'template_id', 1,
  'send_to', 'candidate_email',
  'subject', 'Welcome to {{company_name}} - Application Received',
  'delay_minutes', 0
));

-- Action 2: Screening Task
INSERT INTO automation_actions (automation_id, action_type, action_order, config) VALUES
(2, 'task', 1, JSON_OBJECT(
  'title', 'Schedule screening call with {{candidate_name}}',
  'description', 'Review resume and schedule initial screening call',
  'assigned_to', 'recruiter',
  'due_in_days', 2,
  'priority', 'high'
));

-- Action 3: Interview Email
INSERT INTO automation_actions (automation_id, action_type, action_order, config) VALUES
(3, 'email', 1, JSON_OBJECT(
  'template_id', 2,
  'send_to', 'candidate_email',
  'subject', 'Interview Scheduled - {{company_name}}',
  'delay_minutes', 0
));

-- Action 4: Offer Task
INSERT INTO automation_actions (automation_id, action_type, action_order, config) VALUES
(4, 'task', 1, JSON_OBJECT(
  'title', 'Prepare offer letter for {{candidate_name}}',
  'description', 'Draft and review offer letter with compensation details',
  'assigned_to', 'hr_manager',
  'due_in_days', 1,
  'priority', 'urgent'
));

-- Insert default pipeline rules
INSERT INTO pipeline_rules (name, rule_type, config, is_active) VALUES
('Allow Stage Skipping', 'stage_transition', JSON_OBJECT('allow_skip', TRUE), TRUE),
('Require Interview Before Offer', 'stage_transition', JSON_OBJECT(
  'from_stage', 'Screening',
  'to_stage', 'Offer',
  'require_intermediate', 'Interview',
  'enabled', FALSE
), FALSE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_stage_updated ON candidates(stage, stage_updated_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_recent ON activity_logs(entity_type, entity_id, created_at DESC);

-- Add comments for documentation
ALTER TABLE activity_logs COMMENT = 'Comprehensive activity tracking for all entities';
ALTER TABLE pipeline_automations COMMENT = 'Automation rules triggered by stage changes';
ALTER TABLE automation_actions COMMENT = 'Actions to execute when automation is triggered';
ALTER TABLE pipeline_rules COMMENT = 'Validation rules for pipeline transitions';
ALTER TABLE automation_execution_log COMMENT = 'Execution history for debugging and monitoring';
