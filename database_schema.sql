-- HR Workflow Management System - MySQL Database Schema
-- Created based on analysis of existing Supabase schema and application requirements

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Users table (Team Members)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'HR Manager', 'Team Lead', 'Recruiter', 'Interviewer') NOT NULL,
    avatar TEXT,
    status ENUM('Active', 'Away', 'Busy') DEFAULT 'Active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
);

-- Interviewer profiles (for interviewers only)
CREATE TABLE interviewer_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    department VARCHAR(100),
    expertise JSON, -- Array of skills
    interview_types JSON, -- Array of interview types
    total_interviews INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_department (department)
);

-- Permissions table
CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    module VARCHAR(50) NOT NULL,
    actions JSON NOT NULL, -- Array of allowed actions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_module (user_id, module),
    INDEX idx_user_id (user_id),
    INDEX idx_module (module)
);

-- Job postings
CREATE TABLE job_postings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    department VARCHAR(100) NOT NULL,
    location VARCHAR(200) NOT NULL,
    job_type ENUM('Full-time', 'Part-time', 'Contract', 'Internship') NOT NULL,
    status ENUM('Active', 'Paused', 'Closed') DEFAULT 'Active',
    posted_date DATE NOT NULL,
    deadline DATE NOT NULL,
    description TEXT NOT NULL,
    requirements JSON NOT NULL, -- Array of requirements
    applicant_count INT DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_department (department),
    INDEX idx_job_type (job_type),
    INDEX idx_posted_date (posted_date),
    INDEX idx_created_by (created_by)
);

-- Job portals
CREATE TABLE job_portals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    status ENUM('Posted', 'Draft', 'Expired') DEFAULT 'Draft',
    applicants INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    INDEX idx_job_id (job_id),
    INDEX idx_status (status),
    INDEX idx_name (name)
);

-- Job assignments (many-to-many relationship)
CREATE TABLE job_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_id INT NOT NULL,
    user_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_job_user (job_id, user_id),
    INDEX idx_job_id (job_id),
    INDEX idx_user_id (user_id)
);

-- Candidates
CREATE TABLE candidates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    position VARCHAR(200) NOT NULL,
    stage ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected') DEFAULT 'Applied',
    source VARCHAR(100) NOT NULL,
    applied_date DATE NOT NULL,
    resume_path TEXT,
    notes TEXT,
    score DECIMAL(3,2) DEFAULT 0.00,
    assigned_to INT NOT NULL,
    skills JSON, -- Array of skills
    experience VARCHAR(100),
    salary_expected VARCHAR(50),
    salary_offered VARCHAR(50),
    salary_negotiable BOOLEAN DEFAULT TRUE,
    joining_time VARCHAR(50),
    notice_period VARCHAR(50),
    immediate_joiner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_stage (stage),
    INDEX idx_source (source),
    INDEX idx_applied_date (applied_date),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_email (email),
    INDEX idx_score (score)
);

-- Communications
CREATE TABLE communications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    candidate_id INT NOT NULL,
    type ENUM('Email', 'Phone', 'WhatsApp', 'LinkedIn') NOT NULL,
    date TIMESTAMP NOT NULL,
    content TEXT NOT NULL,
    status ENUM('Sent', 'Received', 'Pending') DEFAULT 'Pending',
    follow_up TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_type (type),
    INDEX idx_date (date),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
);

-- Interviews
CREATE TABLE interviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    candidate_id INT NOT NULL,
    interviewer_id INT NOT NULL,
    scheduled_date TIMESTAMP NOT NULL,
    duration INT NOT NULL, -- in minutes
    type ENUM('Technical', 'HR', 'Managerial', 'Final') NOT NULL,
    status ENUM('Scheduled', 'Completed', 'Cancelled', 'Rescheduled') DEFAULT 'Scheduled',
    meeting_link TEXT,
    location TEXT,
    round INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES users(id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_interviewer_id (interviewer_id),
    INDEX idx_scheduled_date (scheduled_date),
    INDEX idx_status (status),
    INDEX idx_type (type),
    INDEX idx_round (round)
);

-- Interview feedback
CREATE TABLE interview_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    interview_id INT NOT NULL,
    interviewer_id INT NOT NULL,
    ratings JSON NOT NULL, -- Array of skill ratings
    overall_rating DECIMAL(3,2) NOT NULL,
    comments TEXT,
    recommendation ENUM('Selected', 'On Hold', 'Rejected') NOT NULL,
    strengths JSON, -- Array of strengths
    weaknesses JSON, -- Array of weaknesses
    additional_notes TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES users(id),
    UNIQUE KEY unique_interview_feedback (interview_id),
    INDEX idx_interview_id (interview_id),
    INDEX idx_interviewer_id (interviewer_id),
    INDEX idx_recommendation (recommendation),
    INDEX idx_submitted_at (submitted_at)
);

-- Pre-interview feedback
CREATE TABLE pre_interview_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    candidate_id INT NOT NULL,
    submitted_by INT NOT NULL,
    resume_review_rating DECIMAL(3,2) NOT NULL,
    resume_review_comments TEXT,
    skills_assessment_rating DECIMAL(3,2) NOT NULL,
    skills_assessment_comments TEXT,
    cultural_fit_rating DECIMAL(3,2) NOT NULL,
    cultural_fit_comments TEXT,
    overall_recommendation ENUM('Proceed', 'Hold', 'Reject') NOT NULL,
    notes TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    UNIQUE KEY unique_candidate_pre_feedback (candidate_id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_submitted_by (submitted_by),
    INDEX idx_overall_recommendation (overall_recommendation),
    INDEX idx_submitted_at (submitted_at)
);

-- Post-interview feedback
CREATE TABLE post_interview_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    candidate_id INT NOT NULL,
    interview_id INT NOT NULL,
    submitted_by INT NOT NULL,
    technical_skills JSON, -- Array of technical skill ratings
    soft_skills JSON, -- Array of soft skill ratings
    overall_performance DECIMAL(3,2) NOT NULL,
    recommendation ENUM('Hire', 'Maybe', 'No Hire') NOT NULL,
    salary_recommendation VARCHAR(50),
    start_date_flexibility INT NOT NULL, -- scale 1-10
    additional_comments TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_interview_id (interview_id),
    INDEX idx_submitted_by (submitted_by),
    INDEX idx_recommendation (recommendation),
    INDEX idx_submitted_at (submitted_at)
);

-- Tasks
CREATE TABLE tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    assigned_to INT NOT NULL,
    job_id VARCHAR(36),
    candidate_id VARCHAR(36),
    priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    due_date DATE NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE SET NULL,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_job_id (job_id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_created_by (created_by)
);

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSON NOT NULL,
    description TEXT,
    updated_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id),
    INDEX idx_setting_key (setting_key),
    INDEX idx_updated_by (updated_by)
);

-- Email templates
CREATE TABLE email_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    type ENUM('Interview Invite', 'Rejection', 'Offer', 'Follow-up', 'Custom') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_type (type),
    INDEX idx_is_active (is_active),
    INDEX idx_created_by (created_by)
);

-- Analytics cache table for performance
CREATE TABLE analytics_cache (
    id INT PRIMARY KEY AUTO_INCREMENT,
    metric_name VARCHAR(100) NOT NULL,
    metric_data JSON NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE KEY unique_metric (metric_name),
    INDEX idx_metric_name (metric_name),
    INDEX idx_expires_at (expires_at)
);

-- Create indexes for better performance
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_candidates_stage_assigned ON candidates(stage, assigned_to);
CREATE INDEX idx_interviews_date_status ON interviews(scheduled_date, status);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_communications_candidate_date ON communications(candidate_id, date);

-- Insert default admin user
INSERT INTO users (id, username, email, name, password_hash, role, status) VALUES 
('admin-001', 'admin', 'admin@company.com', 'System Administrator', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'Active');

-- Insert default permissions for admin
INSERT INTO permissions (user_id, module, actions) VALUES 
('admin-001', 'dashboard', '["view"]'),
('admin-001', 'jobs', '["view", "create", "edit", "delete"]'),
('admin-001', 'candidates', '["view", "create", "edit", "delete"]'),
('admin-001', 'communications', '["view", "create", "edit", "delete"]'),
('admin-001', 'tasks', '["view", "create", "edit", "delete"]'),
('admin-001', 'team', '["view", "create", "edit", "delete"]'),
('admin-001', 'analytics', '["view"]'),
('admin-001', 'settings', '["view", "edit"]');

-- Insert default email templates
INSERT INTO email_templates (id, name, subject, body, type, created_by) VALUES 
('template-001', 'Interview Invitation', 'Interview Invitation - {{position}}', 'Dear {{candidate_name}},\n\nThank you for your interest in the {{position}} position. We would like to invite you for an interview.\n\nDate: {{interview_date}}\nTime: {{interview_time}}\nLocation: {{location}}\n\nBest regards,\n{{company_name}}', 'Interview Invite', 'admin-001'),
('template-002', 'Job Offer', 'Job Offer - {{position}}', 'Dear {{candidate_name}},\n\nCongratulations! We are pleased to offer you the position of {{position}}.\n\nPlease review the attached offer letter and let us know your decision.\n\nBest regards,\n{{company_name}}', 'Offer', 'admin-001'),
('template-003', 'Rejection Notice', 'Application Update - {{position}}', 'Dear {{candidate_name}},\n\nThank you for your interest in the {{position}} position. After careful consideration, we have decided to move forward with other candidates.\n\nWe wish you the best in your job search.\n\nBest regards,\n{{company_name}}', 'Rejection', 'admin-001');

-- Insert default system settings
INSERT INTO system_settings (id, setting_key, setting_value, description, updated_by) VALUES 
('setting-001', 'notifications', '{"newApplications": true, "interviewReminders": true, "taskDeadlines": true, "teamUpdates": true, "systemAlerts": true}', 'Notification preferences', 'admin-001'),
('setting-002', 'security', '{"twoFactorAuth": false, "sessionTimeout": 30}', 'Security settings', 'admin-001'),
('setting-003', 'database', '{"backupFrequency": "Daily", "dataRetention": 24}', 'Database settings', 'admin-001');

