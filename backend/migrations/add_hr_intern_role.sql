-- Add HR Intern role to users table
ALTER TABLE `users` MODIFY `role` enum('Admin','HR Manager','Team Lead','Recruiter','Interviewer','HR Intern') NOT NULL;
