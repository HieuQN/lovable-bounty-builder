-- Insert dummy properties with existing analysis
INSERT INTO public.properties (id, full_address, street_address, city, state, zip_code) VALUES
('11111111-1111-1111-1111-111111111111', '123 Main Street, Newtown, CT 06470', '123 Main Street', 'Newtown', 'CT', '06470'),
('22222222-2222-2222-2222-222222222222', '456 Oak Avenue, Newtown, CT 06470', '456 Oak Avenue', 'Newtown', 'CT', '06470'),
('33333333-3333-3333-3333-333333333333', '789 Pine Road, Newtown, CT 06470', '789 Pine Road', 'Newtown', 'CT', '06470'),
('44444444-4444-4444-4444-444444444444', '321 Elm Street, Newtown, CT 06470', '321 Elm Street', 'Newtown', 'CT', '06470');

-- Insert dummy disclosure reports for existing properties
INSERT INTO public.disclosure_reports (
  id,
  property_id, 
  status, 
  risk_score, 
  report_summary_basic, 
  report_summary_full, 
  dummy_analysis_complete,
  raw_pdf_url
) VALUES
(
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'complete',
  7.2,
  'This report for 123 Main Street highlights potential concerns with the electrical system and roof condition. Our analysis reveals a Federal Pacific panel that poses safety risks and an aging roof nearing replacement time.',
  '{"risk_score": 7.2, "summary_teaser": "This report for 123 Main Street highlights potential concerns with the electrical system and roof condition.", "findings": [{"category": "Electrical", "issue": "Federal Pacific electrical panel installed in 1978. These panels are known fire hazards.", "risk_level": "High", "estimated_cost": "$2,500 - $4,000", "negotiation_point": "Strongly recommend panel replacement as condition of sale. Many insurers will not cover homes with FP panels."}, {"category": "Roof", "issue": "Asphalt shingle roof is 22 years old with visible wear on south-facing slope.", "risk_level": "Medium", "estimated_cost": "$12,000 - $18,000", "negotiation_point": "Roof replacement will be needed within 2-3 years. Request seller credit or price reduction."}, {"category": "Foundation", "issue": "Minor hairline crack in basement wall, previously sealed.", "risk_level": "Low", "estimated_cost": "$300 - $800", "negotiation_point": "Monitor for expansion but not a major concern at this time."}]}',
  true,
  'dummy-pdf-url-123main'
),
(
  '22222222-bbbb-bbbb-bbbb-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'complete',
  4.1,
  'This report for 456 Oak Avenue shows a well-maintained property with only minor cosmetic issues noted in the disclosure. The major systems appear to be in good condition with recent updates.',
  '{"risk_score": 4.1, "summary_teaser": "This report for 456 Oak Avenue shows a well-maintained property with only minor cosmetic issues.", "findings": [{"category": "HVAC", "issue": "Central air conditioning unit is 12 years old but well-maintained with recent service.", "risk_level": "Low", "estimated_cost": "$0 - $500", "negotiation_point": "System is operating well. Consider extended warranty for peace of mind."}, {"category": "Plumbing", "issue": "Kitchen faucet has minor drip that seller plans to repair before closing.", "risk_level": "Low", "estimated_cost": "$50 - $150", "negotiation_point": "Very minor issue. Ensure repair is completed as agreed."}, {"category": "Windows", "issue": "All windows replaced in 2019 with energy-efficient models.", "risk_level": "Low", "estimated_cost": "$0", "negotiation_point": "Recent upgrade adds value. No concerns."}]}',
  true,
  'dummy-pdf-url-456oak'
),
(
  '33333333-cccc-cccc-cccc-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'complete',
  8.7,
  'This report for 789 Pine Road reveals significant concerns requiring immediate attention. Foundation issues and outdated electrical systems present substantial risks and costs.',
  '{"risk_score": 8.7, "summary_teaser": "This report for 789 Pine Road reveals significant concerns requiring immediate attention.", "findings": [{"category": "Foundation", "issue": "Multiple foundation cracks with signs of ongoing water intrusion in basement.", "risk_level": "High", "estimated_cost": "$8,000 - $15,000", "negotiation_point": "Major structural concern. Recommend full foundation inspection and significant price adjustment."}, {"category": "Electrical", "issue": "Knob and tube wiring still present in portions of the home, not up to current code.", "risk_level": "High", "estimated_cost": "$6,000 - $12,000", "negotiation_point": "Safety hazard and insurance issue. Full rewiring required."}, {"category": "Plumbing", "issue": "Galvanized pipes showing corrosion and reduced water pressure throughout home.", "risk_level": "Medium", "estimated_cost": "$4,000 - $8,000", "negotiation_point": "Replacement needed within 1-2 years. Factor into purchase price."}]}',
  true,
  'dummy-pdf-url-789pine'
);