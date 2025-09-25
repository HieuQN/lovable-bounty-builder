import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();

    if (!reportId) {
      return new Response(JSON.stringify({ error: 'Report ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch report data
    const { data: report, error: reportError } = await supabase
      .from('disclosure_reports')
      .select(`
        *,
        properties (
          full_address,
          city,
          state,
          zip_code
        )
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('Error fetching report:', reportError);
      return new Response(JSON.stringify({ error: 'Report not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate HTML content for the PDF
    const htmlContent = generateReportHTML(report);

    // Use Puppeteer to generate PDF
    const puppeteer = await import('https://deno.land/x/puppeteer@16.2.0/mod.ts');
    
    const browser = await (puppeteer as any).launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });
    
    await browser.close();

    // Return PDF as response
    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="disclosure-report-${report.properties?.full_address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property'}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error in generate-pdf-report function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateReportHTML(report: any): string {
  const property = report.properties;
  const findings = report.report_summary_full?.findings || [];
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 20px;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .title {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin: 0;
        }
        .subtitle {
          font-size: 18px;
          color: #6b7280;
          margin: 10px 0 0 0;
        }
        .property-info {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .property-address {
          font-size: 22px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }
        .risk-score {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          margin: 15px 0;
        }
        .risk-low { background: #dcfce7; color: #166534; }
        .risk-medium { background: #fef3c7; color: #92400e; }
        .risk-high { background: #fecaca; color: #991b1b; }
        .summary {
          background: #fafafa;
          border-left: 4px solid #2563eb;
          padding: 20px;
          margin: 20px 0;
        }
        .findings-section {
          margin-top: 30px;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .finding {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .finding-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .finding-category {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
        }
        .finding-risk {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .finding-content {
          color: #4b5563;
          margin-bottom: 15px;
        }
        .finding-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .detail-item {
          background: #f9fafb;
          padding: 10px;
          border-radius: 6px;
        }
        .detail-label {
          font-weight: bold;
          color: #374151;
          margin-bottom: 5px;
        }
        .page-number {
          background: #e5e7eb;
          color: #374151;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-left: 10px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
        @media print {
          body { margin: 0; }
          .finding { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">Property Disclosure Report</h1>
        <p class="subtitle">Comprehensive Analysis & Risk Assessment</p>
      </div>

      <div class="property-info">
        <div class="property-address">${property?.full_address || 'Property Address'}</div>
        <div>${property?.city || ''}, ${property?.state || ''} ${property?.zip_code || ''}</div>
        
        ${report.risk_score ? `
          <div class="risk-score ${getRiskClass(report.risk_score)}">
            Overall Risk Score: ${report.risk_score}/10
          </div>
        ` : ''}
        
        <div style="margin-top: 15px; color: #6b7280;">
          <strong>Report Generated:</strong> ${new Date(report.created_at).toLocaleDateString()}
        </div>
      </div>

      ${report.report_summary_basic ? `
        <div class="summary">
          <h3>Executive Summary</h3>
          <p>${report.report_summary_basic}</p>
        </div>
      ` : ''}

      ${findings.length > 0 ? `
        <div class="findings-section">
          <h2 class="section-title">Detailed Findings</h2>
          ${findings.map((finding: any) => `
            <div class="finding">
              <div class="finding-header">
                <div class="finding-category">${finding.category || 'General Finding'}</div>
                <div>
                  ${finding.risk_level ? `
                    <span class="finding-risk ${getRiskClass(finding.risk_level)}">
                      ${finding.risk_level.charAt(0).toUpperCase() + finding.risk_level.slice(1)} Risk
                    </span>
                  ` : ''}
                  ${finding.source_page ? `
                    <span class="page-number">Page ${finding.source_page}</span>
                  ` : ''}
                </div>
              </div>
              
              <div class="finding-content">
                ${finding.finding || finding.issue || 'No details available'}
              </div>
              
              <div class="finding-details">
                ${finding.estimated_cost ? `
                  <div class="detail-item">
                    <div class="detail-label">Estimated Cost</div>
                    <div>${finding.estimated_cost}</div>
                  </div>
                ` : ''}
                ${finding.urgency ? `
                  <div class="detail-item">
                    <div class="detail-label">Urgency</div>
                    <div>${finding.urgency}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="footer">
        <p>This report was generated using AI analysis of the property disclosure documents.</p>
        <p>Please consult with qualified professionals for specific advice regarding any findings.</p>
      </div>
    </body>
    </html>
  `;
}

function getRiskClass(risk: any): string {
  if (typeof risk === 'number') {
    if (risk <= 3) return 'risk-low';
    if (risk <= 6) return 'risk-medium';
    return 'risk-high';
  }
  
  const riskStr = String(risk).toLowerCase();
  if (riskStr.includes('low')) return 'risk-low';
  if (riskStr.includes('medium')) return 'risk-medium';
  if (riskStr.includes('high')) return 'risk-high';
  return 'risk-medium';
}