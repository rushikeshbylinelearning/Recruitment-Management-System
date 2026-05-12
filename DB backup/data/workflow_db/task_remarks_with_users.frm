TYPE=VIEW
query=select `tr`.`id` AS `id`,`tr`.`task_id` AS `task_id`,`t`.`name` AS `task_name`,`tr`.`added_by` AS `added_by`,`tr`.`added_by_type` AS `added_by_type`,case when `tr`.`added_by_type` = \'team\' then `tm`.`name` when `tr`.`added_by_type` = \'admin\' then `au`.`name` else \'Unknown\' end AS `user_name`,`tr`.`remark_date` AS `remark_date`,`tr`.`remark` AS `remark`,`tr`.`remark_type` AS `remark_type`,`tr`.`is_private` AS `is_private`,`tr`.`created_at` AS `created_at` from (((`workflow_db`.`task_remarks` `tr` join `workflow_db`.`tasks` `t` on(`tr`.`task_id` = `t`.`id`)) left join `workflow_db`.`team_members` `tm` on(`tr`.`added_by` = `tm`.`id` and `tr`.`added_by_type` = \'team\')) left join `workflow_db`.`admin_users` `au` on(`tr`.`added_by` = `au`.`id` and `tr`.`added_by_type` = \'admin\')) order by `tr`.`remark_date` desc,`tr`.`created_at` desc
md5=b36769fb52ce9a7211b2d918ddaffac1
updatable=0
algorithm=0
definer_user=root
definer_host=localhost
suid=1
with_check_option=0
timestamp=0001778064655097980
create-version=2
source=SELECT `tr`.`id` AS `id`, `tr`.`task_id` AS `task_id`, `t`.`name` AS `task_name`, `tr`.`added_by` AS `added_by`, `tr`.`added_by_type` AS `added_by_type`, (case when (`tr`.`added_by_type` = \'team\') then `tm`.`name` when (`tr`.`added_by_type` = \'admin\') then `au`.`name` else \'Unknown\' end) AS `user_name`, `tr`.`remark_date` AS `remark_date`, `tr`.`remark` AS `remark`, `tr`.`remark_type` AS `remark_type`, `tr`.`is_private` AS `is_private`, `tr`.`created_at` AS `created_at` FROM (((`task_remarks` `tr` join `tasks` `t` on((`tr`.`task_id` = `t`.`id`))) left join `team_members` `tm` on(((`tr`.`added_by` = `tm`.`id`) and (`tr`.`added_by_type` = \'team\')))) left join `admin_users` `au` on(((`tr`.`added_by` = `au`.`id`) and (`tr`.`added_by_type` = \'admin\')))) ORDER BY `tr`.`remark_date` DESC, `tr`.`created_at` DESC
client_cs_name=utf8mb4
connection_cl_name=utf8mb4_general_ci
view_body_utf8=select `tr`.`id` AS `id`,`tr`.`task_id` AS `task_id`,`t`.`name` AS `task_name`,`tr`.`added_by` AS `added_by`,`tr`.`added_by_type` AS `added_by_type`,case when `tr`.`added_by_type` = \'team\' then `tm`.`name` when `tr`.`added_by_type` = \'admin\' then `au`.`name` else \'Unknown\' end AS `user_name`,`tr`.`remark_date` AS `remark_date`,`tr`.`remark` AS `remark`,`tr`.`remark_type` AS `remark_type`,`tr`.`is_private` AS `is_private`,`tr`.`created_at` AS `created_at` from (((`workflow_db`.`task_remarks` `tr` join `workflow_db`.`tasks` `t` on(`tr`.`task_id` = `t`.`id`)) left join `workflow_db`.`team_members` `tm` on(`tr`.`added_by` = `tm`.`id` and `tr`.`added_by_type` = \'team\')) left join `workflow_db`.`admin_users` `au` on(`tr`.`added_by` = `au`.`id` and `tr`.`added_by_type` = \'admin\')) order by `tr`.`remark_date` desc,`tr`.`created_at` desc
mariadb-version=100432
