-- Check the current enum values for showing_status
SELECT unnest(enum_range(NULL::showing_status)) AS enum_value;