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
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      if (selectedFile.size > 200 * 1024 * 1024) { // 200MB limit (direct Gemini processing)
        setError('File size must be less than 200MB');
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };


  const handleUpload = useCallback(async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setIsProcessing(true);
    setProcessingProgress(0);
    setError('');

    try {
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

      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop();

      setProcessingProgress(10);

      // PARALLEL PROCESSING: Upload to storage (for record keeping) AND direct Gemini analysis
      const promises = [];

      // 1. Upload to Supabase Storage for record keeping
      const filePath = `${user.id}/${timestamp}-${reportId}.${fileExtension}`;
      const storageUpload = supabase.storage
        .from('disclosure-uploads')
        .upload(filePath, file);
      promises.push(storageUpload);

      // 2. Convert PDF to base64 for direct Gemini API call
      const fileReader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        fileReader.onload = () => {
          const result = fileReader.result as string;
          // Remove data:application/pdf;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        fileReader.onerror = reject;
        fileReader.readAsDataURL(file);
      });
      promises.push(base64Promise);

      setProcessingProgress(25);

      // Wait for both storage upload and base64 conversion
      const [storageResult, pdfBase64] = await Promise.all(promises);

      if (storageResult.error) {
        console.warn('Storage upload failed (proceeding with analysis):', storageResult.error.message);
      } else {
        console.log('Successfully uploaded to storage for record keeping');
      }

      setProcessingProgress(40);

      // Direct Gemini API analysis (no 20MB limit)
      console.log(`Starting direct Gemini analysis for PDF (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      console.log('Calling gemini-direct-analysis function with reportId:', reportId);
      
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
        'gemini-direct-analysis',
        {
          body: { 
            reportId: reportId,
            pdfBase64: pdfBase64,
            fileName: file.name
          }
        }
      );

      console.log('Analysis function response:', { analysisResult, analysisError });

      setProcessingProgress(100);

      if (analysisError) {
        throw new Error(`Direct analysis failed: ${analysisError.message}`);
      }

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Analysis completed but returned no results');
      }

      toast({
        title: "Analysis Complete",
        description: "Your disclosure document has been successfully analyzed using direct Gemini processing!",
      });

      onAnalysisComplete({
        success: true,
        message: 'Analysis completed successfully via direct Gemini API',
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
      setIsProcessing(false);
      setProcessingProgress(0);
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
                disabled={isUploading}
                className="cursor-pointer"
              />
            </div>

            {fileName && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{fileName}</span>
                {file && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {(file.size / (1024 * 1024)).toFixed(1)}MB
                    {file.size > 50 * 1024 * 1024 && " (large file - direct Gemini processing)"}
                  </span>
                )}
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading & Analyzing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload and Analyze PDF
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
                <h3 className="text-lg font-semibold">Processing PDF</h3>
                <p className="text-muted-foreground">
                  Analyzing your disclosure document directly with Gemini AI...
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="w-full" />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsProcessing(false);
                  setUploadJobId(null);
                  setFile(null);
                  setFileName('');
                  setProcessingProgress(0);
                }}
              >
                Cancel & Upload Another File
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PDFAnalyzer;