-- Add foreign key constraint to link purchases to disclosure_reports
ALTER TABLE public.purchases 
ADD CONSTRAINT fk_purchases_disclosure_report 
FOREIGN KEY (disclosure_report_id) 
REFERENCES public.disclosure_reports(id) 
ON DELETE CASCADE;