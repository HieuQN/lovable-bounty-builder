import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Loader2, Upload, FileText, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './ui/use-toast';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit (no longer constrained by edge function)
        setError('File size must be less than 50MB');
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    setIsExtractingText(true);
    setExtractProgress(0);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = '';
      
      const totalPages = pdf.numPages;
      console.log(`PDF has ${totalPages} pages`);

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        extractedText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
        
        // Update progress
        const progress = (pageNum / totalPages) * 100;
        setExtractProgress(progress);
      }

      console.log(`Extracted ${extractedText.length} characters from PDF`);
      return extractedText.trim();
    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    } finally {
      setIsExtractingText(false);
      setExtractProgress(0);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Extract text from PDF client-side
      const extractedText = await extractTextFromPDF(file);
      
      if (!extractedText || extractedText.length < 100) {
        throw new Error('Could not extract meaningful text from PDF. Please ensure it\'s a valid disclosure document.');
      }

      // Get the disclosure report ID from the parent component
      const reportId = await onAnalysisStart();
      
      // Get current user to identify the agent
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get agent profile
      const { data: agentProfile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agentProfile) {
        throw new Error('Agent profile not found');
      }

      // Upload the original PDF file to storage for reference
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop();
      const filePath = `${user.id}/${timestamp}-${reportId}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('disclosure-uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Start direct analysis with extracted text
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'analyze-pdf-disclosure',
        {
          body: { 
            pdfText: extractedText,
            reportId: reportId,
            fileName: file.name
          }
        }
      );

      if (analysisError) {
        throw new Error(`Analysis failed: ${analysisError.message}`);
      }

      toast({
        title: "Analysis Complete",
        description: "Your disclosure document has been successfully analyzed!",
      });

      // Notify parent that analysis completed successfully
      onAnalysisComplete({
        success: true,
        message: 'Analysis completed successfully',
        result: analysisResult
      });

    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [file, onAnalysisStart, onAnalysisComplete]);

  const checkJobStatus = useCallback(async () => {
    if (!uploadJobId) return;

    try {
      const { data: job, error } = await supabase
        .from('disclosure_upload_jobs')
        .select('status, error_message, completed_at')
        .eq('id', uploadJobId)
        .single();

      if (error) {
        console.error('Error checking job status:', error);
        return;
      }

      if (job.status === 'completed') {
        setIsProcessing(false);
        toast({
          title: "Processing Complete",
          description: "Your disclosure report has been successfully processed.",
        });
        onAnalysisComplete({
          success: true,
          message: 'Processing completed successfully'
        });
      } else if (job.status === 'failed') {
        setIsProcessing(false);
        setError(job.error_message || 'Processing failed');
        toast({
          title: "Processing Failed",
          description: job.error_message || 'Unknown error occurred during processing',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
  }, [uploadJobId, onAnalysisComplete]);

  // Poll job status every 5 seconds when processing
  React.useEffect(() => {
    if (isProcessing && uploadJobId) {
      const interval = setInterval(checkJobStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isProcessing, uploadJobId, checkJobStatus]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Property Disclosure
        </CardTitle>
        <CardDescription>
          Upload a PDF file of the property disclosure document for AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isProcessing ? (
          <>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="pdf-upload">Select PDF File</Label>
              <Input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={isUploading || isExtractingText}
                className="cursor-pointer"
              />
            </div>

            {fileName && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{fileName}</span>
              </div>
            )}

            {isExtractingText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Extracting text from PDF...</span>
                  <span>{Math.round(extractProgress)}%</span>
                </div>
                <Progress value={extractProgress} className="w-full" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading || isExtractingText}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isExtractingText ? 'Extracting Text...' : 'Analyzing...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Extract Text & Analyze
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Clock className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Processing in Background</h3>
                <p className="text-muted-foreground">
                  Your file has been uploaded and is being analyzed by AI. You can safely close this page.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You'll receive a notification when the analysis is complete.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsProcessing(false);
                  setUploadJobId(null);
                  setFile(null);
                  setFileName('');
                }}
              >
                Upload Another File
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PDFAnalyzer;