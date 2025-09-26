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
      if (selectedFile.size > 100 * 1024 * 1024) { // 100MB limit (we'll chunk it)
        setError('File size must be less than 100MB');
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError('');
    }
  };

  const splitPDFIntoChunks = async (file: File, chunkSizeMB: number = 18): Promise<File[]> => {
    const chunkSize = chunkSizeMB * 1024 * 1024; // Convert to bytes
    const chunks: File[] = [];
    
    for (let start = 0; start < file.size; start += chunkSize) {
      const end = Math.min(start + chunkSize, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkIndex = Math.floor(start / chunkSize) + 1;
      const chunkFile = new File([chunkBlob], `${file.name}_chunk_${chunkIndex}`, {
        type: file.type
      });
      chunks.push(chunkFile);
    }
    
    console.log(`Split PDF into ${chunks.length} chunks`);
    return chunks;
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

      // Check if file needs to be chunked (over 20MB)
      const fileSizeMB = file.size / (1024 * 1024);
      
      if (fileSizeMB > 20) {
        console.log(`Large PDF detected (${fileSizeMB.toFixed(2)}MB), splitting into chunks...`);
        
        // Split PDF into chunks
        const chunks = await splitPDFIntoChunks(file, 18); // Use 18MB chunks for safety
        const chunkResults: any[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const chunkPath = `${user.id}/${timestamp}-${reportId}_chunk_${i + 1}.${fileExtension}`;
          
          setProcessingProgress(((i + 1) / chunks.length) * 50); // First 50% for upload
          
          // Upload chunk to storage
          const { error: uploadError } = await supabase.storage
            .from('disclosure-uploads')
            .upload(chunkPath, chunk);

          if (uploadError) {
            throw new Error(`Chunk upload failed: ${uploadError.message}`);
          }

          // Analyze chunk
          const { data: chunkResult, error: analysisError } = await supabase.functions.invoke(
            'analyze-pdf-disclosure',
            {
              body: { 
                reportId: reportId,
                bucket: 'disclosure-uploads',
                filePath: chunkPath,
                fileName: `${file.name} (chunk ${i + 1}/${chunks.length})`
              }
            }
          );

          if (analysisError) {
            console.error(`Chunk ${i + 1} analysis failed:`, analysisError);
            // Continue with other chunks
          } else {
            chunkResults.push(chunkResult);
          }
          
          setProcessingProgress(50 + ((i + 1) / chunks.length) * 50); // Last 50% for analysis
        }

        toast({
          title: "Analysis Complete",
          description: `Successfully processed ${chunkResults.length}/${chunks.length} chunks of your PDF.`,
        });

        onAnalysisComplete({
          success: true,
          message: `Analysis completed for ${chunkResults.length}/${chunks.length} chunks`,
          result: { chunks: chunkResults, totalChunks: chunks.length }
        });

      } else {
        // Single file processing (under 20MB)
        const filePath = `${user.id}/${timestamp}-${reportId}.${fileExtension}`;

        setProcessingProgress(25);

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('disclosure-uploads')
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        setProcessingProgress(50);

        // Start analysis
        const { data: analysisResult, error: analysisError } = await supabase.functions.invoke(
          'analyze-pdf-disclosure',
          {
            body: { 
              reportId: reportId,
              bucket: 'disclosure-uploads',
              filePath: filePath,
              fileName: file.name
            }
          }
        );

        setProcessingProgress(100);

        if (analysisError) {
          throw new Error(`Analysis failed: ${analysisError.message}`);
        }

        toast({
          title: "Analysis Complete",
          description: "Your disclosure document has been successfully analyzed!",
        });

        onAnalysisComplete({
          success: true,
          message: 'Analysis completed successfully',
          result: analysisResult
        });
      }

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
                    {file.size > 20 * 1024 * 1024 && " (will be chunked)"}
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
                  {file && file.size > 20 * 1024 * 1024 
                    ? 'Large PDF detected - splitting into chunks for analysis...'
                    : 'Analyzing your disclosure document...'
                  }
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