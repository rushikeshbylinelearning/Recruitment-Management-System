TYPE=VIEW
query=select `te`.`id` AS `id`,`te`.`task_id` AS `task_id`,`t`.`name` AS `task_name`,`te`.`requested_by` AS `requested_by`,`te`.`requested_by_type` AS `requested_by_type`,case when `te`.`requested_by_type` = \'team\' then `tm`.`name` when `te`.`requested_by_type` = \'admin\' then `au`.`name` else \'Unknown\' end AS `requester_name`,`te`.`current_due_date` AS `current_due_date`,`te`.`requested_due_date` AS `requested_due_date`,`te`.`reason` AS `reason`,`te`.`status` AS `status`,`te`.`created_at` AS `created_at` from (((`workflow_db`.`task_extensions` `te` join `workflow_db`.`tasks` `t` on(`te`.`task_id` = `t`.`id`)) left join `workflow_db`.`team_members` `tm` on(`te`.`requested_by` = `tm`.`id` and `te`.`requested_by_type` = \'team\')) left join `workflow_db`.`admin_users` `au` on(`te`.`requested_by` = `au`.`id` and `te`.`requested_by_type` = \'admin\')) where `te`.`status` = \'pending\' order by `te`.`created_at` desc
md5=7506b2e6142f0762927ff71179e51f73
updatable=0
algorithm=0
definer_user=root
definer_host=localhost
suid=1
with_check_option=0
timestamp=0001778064655082703
create-version=2
source=SELECT `te`.`id` AS `id`, `te`.`task_id` AS `task_id`, `t`.`name` AS `task_name`, `te`.`requested_by` AS `requested_by`, `te`.`requested_by_type` AS `requested_by_type`, (case when (`te`.`requested_by_type` = \'team\') then `tm`.`name` when (`te`.`requested_by_type` = \'admin\') then `au`.`name` else \'Unknown\' end) AS `requester_name`, `te`.`current_due_date` AS `current_due_date`, `te`.`requested_due_date` AS `requested_due_date`, `te`.`reason` AS `reason`, `te`.`status` AS `status`, `te`.`created_at` AS `created_at` FROM (((`task_extensions` `te` join `tasks` `t` on((`te`.`task_id` = `t`.`id`))) left join `team_members` `tm` on(((`te`.`requested_by` = `tm`.`id`) and (`te`.`requested_by_type` = \'team\')))) left join `admin_users` `au` on(((`te`.`requested_by` = `au`.`id`) and (`te`.`requested_by_type` = \'admin\')))) WHERE (`te`.`status` = \'pending\') ORDER BY `te`.`created_at` DESC
client_cs_name=utf8mb4
connection_cl_name=utf8mb4_general_ci
view_body_utf8=select `te`.`id` AS `id`,`te`.`task_id` AS `task_id`,`t`.`name` AS `task_name`,`te`.`requested_by` AS `requested_by`,`te`.`requested_by_type` AS `requested_by_type`,case when `te`.`requested_by_type` = \'team\' then `tm`.`name` when `te`.`requested_by_type` = \'admin\' then `au`.`name` else \'Unknown\' end AS `requester_name`,`te`.`current_due_date` AS `current_due_date`,`te`.`requested_due_date` AS `requested_due_date`,`te`.`reason` AS `reason`,`te`.`status` AS `status`,`te`.`created_at` AS `created_at` from (((`workflow_db`.`task_extensions` `te` join `workflow_db`.`tasks` `t` on(`te`.`task_id` = `t`.`id`)) left join `workflow_db`.`team_members` `tm` on(`te`.`requested_by` = `tm`.`id` and `te`.`requested_by_type` = \'team\')) left join `workflow_db`.`admin_users` `au` on(`te`.`requested_by` = `au`.`id` and `te`.`requested_by_type` = \'admin\')) where `te`.`status` = \'pending\' order by `te`.`created_at` desc
mariadb-version=100432
