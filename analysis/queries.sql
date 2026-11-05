-- AituFood, Project Stage 2, Part C: the three analysis questions in SQL.
-- Same data and same filter as the Google Sheets steps: seed (test) orders, cancelled orders excluded.
-- Run from the folder aitufood-firebase/analysis:
--   sqlite3 < queries.sql
-- The CSV files are made from a Firestore backup by _report_tools/export_csv.mjs.

.mode csv
.import --csv orders.csv orders
.import --csv order_items.csv order_items
.mode table

-- Q1. Which pickup slots are the busiest?
SELECT pickup_time AS slot, COUNT(*) AS orders
FROM orders
WHERE status <> 'cancelled' AND data_source = 'seed'
GROUP BY pickup_time
ORDER BY pickup_time;

-- Q2. Which menu categories bring the most money (and how many portions)?
SELECT category,
       SUM(CAST(line_total_tenge AS INTEGER)) AS revenue_tenge,
       SUM(CAST(quantity AS INTEGER))         AS portions
FROM order_items
WHERE status <> 'cancelled' AND data_source = 'seed'
GROUP BY category
ORDER BY revenue_tenge DESC;

-- Q3. At what time of day do students place their orders (30-minute intervals)?
SELECT created_half_hour AS placed_from, COUNT(*) AS orders,
       ROUND(AVG(CAST(lead_minutes AS INTEGER))) AS avg_minutes_before_pickup
FROM orders
WHERE status <> 'cancelled' AND data_source = 'seed'
GROUP BY created_half_hour
ORDER BY created_half_hour;

-- Table: one row per pickup day, all orders (seed and live tests), exact values
SELECT pickup_date,
       SUM(status <> 'cancelled')                                         AS orders,
       SUM(status = 'cancelled')                                          AS cancelled,
       SUM(CASE WHEN status <> 'cancelled' THEN CAST(total_tenge AS INTEGER) END) AS revenue_tenge,
       ROUND(AVG(CASE WHEN status <> 'cancelled' THEN CAST(total_tenge AS INTEGER) END)) AS average_tenge,
       GROUP_CONCAT(DISTINCT data_source)                                 AS source
FROM orders
GROUP BY pickup_date
ORDER BY pickup_date;
