-- Reset all reports stuck in processing status back to pending
UPDATE disclosure_reports 
SET status = 'pending', updated_at = now()
WHERE status = 'processing';