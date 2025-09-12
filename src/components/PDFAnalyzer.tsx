import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Upload, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './ui/use-toast';

// Extend Window interface for pdf.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// Load pdf.js from a CDN
const SCRIPT_ID = 'pdfjs-script';
if (!document.getElementById(SCRIPT_ID)) {
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js";
  document.body.appendChild(script);
}

interface PDFAnalyzerProps {
  reportId: string;
  onAnalysisComplete: (result: any) => void;
  onAnalysisStart: () => Promise<string>;
}

export const PDFAnalyzer: React.FC<PDFAnalyzerProps> = ({ 
  onAnalysisComplete, 
  onAnalysisStart 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const extractTextFromPdf = useCallback((file: File) => {
    return new Promise<Array<{page: number, text: string}>>((resolve, reject) => {
      if (!window.pdfjsLib) {
        return reject(new Error("PDF.js library is not loaded yet. Please try again in a moment."));
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const typedarray = new Uint8Array(event.target!.result as ArrayBuffer);
          const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
          const pagesText = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            pagesText.push({ page: i, text: pageText });
          }
          resolve(pagesText);
        } catch (err) {
          reject(new Error("Failed to parse PDF: " + (err as Error).message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read the file."));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    } else {
      setFile(null);
      setFileName('');
      setError('Please select a valid PDF file.');
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a PDF file first.');
      return;
    }
    if (!window.pdfjsLib) {
      setError("The PDF processing library is still loading. Please wait a moment and try again.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Start the analysis process and get report ID
      const actualReportId = await onAnalysisStart();

      // Extract text from PDF
      const pages = await extractTextFromPdf(file);
      if (!pages || pages.length === 0) {
        throw new Error("Could not extract any text from the PDF. The document might be image-based or empty.");
      }

      // Format text for API to include page markers
      const formattedText = pages.map(p => `--- PAGE ${p.page} ---\n${p.text}`).join('\n\n');

      // Call our edge function for analysis
      const { data, error: analysisError } = await supabase.functions.invoke('analyze-pdf-disclosure', {
        body: {
          pdfText: formattedText,
          reportId: actualReportId
        }
      });

      if (analysisError) {
        throw new Error(analysisError.message || 'Analysis failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis was not successful');
      }

      toast({
        title: "Analysis Complete!",
        description: `PDF analysis completed successfully. Risk score: ${data.riskScore}/10`,
      });

      onAnalysisComplete(data);

    } catch (err) {
      const errorMessage = (err as Error).message || 'An unknown error occurred during analysis.';
      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Disclosure Analysis
        </CardTitle>
        <CardDescription>
          Upload a property disclosure PDF to get AI-powered analysis and risk assessment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pdf-upload">Select PDF Document</Label>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
              />
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={!file || isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          {fileName && (
            <p className="text-sm text-muted-foreground">
              Selected: {fileName}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Analyzing document, please wait... This may take up to 30 seconds.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};