export const INVENTORY_REQUIRED_TABLES = [
  'stores',
  'users',
  'products',
  'product_barcodes',
  'product_batches',
  'batch_sales',
  'activity_logs',
  'notification_logs',
  'product_change_logs',
  'product_import_review_queue'
] as const;

export const INVENTORY_REQUIRED_PRODUCT_BATCH_COLUMNS = [
  'id',
  'product_id',
  'store_id',
  'batch_code',
  'quantity',
  'quantity_received',
  'quantity_current',
  'batch_status',
  'expiry_date',
  'delivery_date',
  'notified',
  'notified_at',
  'notified_days',
  'check_status',
  'checked_by_user_id',
  'checked_at',
  'action_taken',
  'action_note',
  'responsible_user_id',
  'discussion_required',
  'discussion_note',
  'discussion_requested_by_user_id',
  'discussion_requested_at',
  'admin_decision',
  'admin_decision_note',
  'admin_decision_by_user_id',
  'admin_decision_at',
  'created_by_user_id',
  'updated_by_user_id',
  'created_at',
  'updated_at'
] as const;

export const INVENTORY_REQUIRED_PRODUCT_COLUMNS = [
  'id',
  'article',
  'product_name',
  'category',
  'default_units_of_measurement',
  'notified_days_default',
  'is_active',
  'created_at',
  'updated_at'
] as const;

export type InventoryRequiredTable = (typeof INVENTORY_REQUIRED_TABLES)[number];

export type InventoryReadiness = {
  checkedAt: string;
  allRequiredTablesPresent: boolean;
  tables: Array<{
    name: InventoryRequiredTable;
    exists: boolean;
  }>;
  productBatches: {
    checked: boolean;
    missingColumns: string[];
  };
};
