-- Performance indexes
CREATE INDEX idx_equipment_customer ON equipment(customer_id);
CREATE INDEX idx_equipment_active ON equipment(active);
CREATE INDEX idx_pm_schedules_equipment ON pm_schedules(equipment_id);
CREATE INDEX idx_pm_schedules_active ON pm_schedules(active);
CREATE INDEX idx_pm_tickets_month_year ON pm_tickets(year, month);
CREATE INDEX idx_pm_tickets_status ON pm_tickets(status);
CREATE INDEX idx_pm_tickets_technician ON pm_tickets(assigned_technician_id);
CREATE INDEX idx_pm_tickets_customer ON pm_tickets(customer_id);
CREATE INDEX idx_pm_tickets_billing_exported ON pm_tickets(billing_exported);
CREATE INDEX idx_customers_synergy_id ON customers(synergy_id);
CREATE INDEX idx_products_synergy_id ON products(synergy_id);
CREATE INDEX idx_sync_log_started_at ON sync_log(started_at DESC);
