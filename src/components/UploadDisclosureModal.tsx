import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Upload, MapPin, Coins, AlertCircle } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';

interface UploadDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bountyId?: string;
}

export const UploadDisclosureModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  bountyId
}: UploadDisclosureModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [existingDisclosure, setExistingDisclosure] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [addressFromBounty, setAddressFromBounty] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'uploaded' | 'analyzing'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch bounty details and pre-populate address if bountyId is provided
  useEffect(() => {
    if (bountyId && isOpen) {
      fetchBountyDetails();
    }
  }, [bountyId, isOpen]);

  const fetchBountyDetails = async () => {
    try {
      const { data: bounty, error: bountyError } = await supabase
        .from('disclosure_bounties')
        .select(`
          property_id,
          properties (
            full_address,
            street_address,
            city,
            state,
            zip_code
          )
        `)
        .eq('id', bountyId)
        .single();

      if (bountyError) throw bountyError;

      if (bounty?.properties) {
        const property = bounty.properties;
        setFullAddress(property.full_address);
        setAddress(property.street_address);
        setCity(property.city);
        setState(property.state);
        setZipCode(property.zip_code);
        setAddressFromBounty(true);
        
        // Check for existing disclosure immediately
        await checkForExistingDisclosureWithAddress(property.full_address);
      }
    } catch (error) {
      console.error('Error fetching bounty details:', error);
    }
  };

  const checkForExistingDisclosureWithAddress = async (addressToCheck: string) => {
    if (!addressToCheck) return;
    
    setCheckingExisting(true);
    try {
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .ilike('full_address', `%${addressToCheck}%`);

      if (propError) throw propError;

      if (properties && properties.length > 0) {
        const { data: reports, error: reportError } = await supabase
          .from('disclosure_reports')
          .select('*')
          .in('property_id', properties.map(p => p.id));

        if (reportError) throw reportError;

        if (reports && reports.length > 0) {
          setExistingDisclosure(reports[0]);
        } else {
          setExistingDisclosure(null);
        }
      } else {
        setExistingDisclosure(null);
      }
    } catch (error) {
      console.error('Error checking existing disclosure:', error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const checkForExistingDisclosure = async () => {
    await checkForExistingDisclosureWithAddress(fullAddress);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
        return;
      }
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a PDF under 100MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setPhase('idle');
      setUploadProgress(0);
    }
  };

  const handleSubmit = async () => {
    if (!file || !fullAddress) {
      toast({
        title: "Missing Information",
        description: "Please select a file and enter a complete address",
        variant: "destructive",
      });
      return;
    }

    if (existingDisclosure) {
      toast({
        title: "Disclosure Already Exists",
        description: "A disclosure for this property already exists in the database",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setPhase('uploading');
    setUploadProgress(5);

    // Simulate determinate upload progress while awaiting SDK upload
    let progressTimer: number | undefined = undefined as any;
    try {
      progressTimer = window.setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 3 : p));
      }, 200);

      // Get agent profile
      const { data: agentProfile, error: agentError } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (agentError) throw agentError;

      // Create or get property
      let propertyId;
      const { data: existingProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('full_address', fullAddress)
        .single();

      if (existingProperty) {
        propertyId = existingProperty.id;
      } else {
        const { data: newProperty, error: propError } = await supabase
          .from('properties')
          .insert({
            full_address: fullAddress,
            street_address: address,
            city,
            state,
            zip_code: zipCode
          })
          .select('id')
          .single();

        if (propError) throw propError;
        propertyId = newProperty.id;
      }

      // Upload file to storage
      const fileName = `${propertyId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('disclosures')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Upload complete UI
      if (progressTimer) window.clearInterval(progressTimer);
      setUploadProgress(100);
      setPhase('uploaded');

      // Fire-and-forget: start AI analysis in background, do not block UI or mark failure
      (async () => {
        try {
          await supabase.functions.invoke('extract-analyze-disclosure', {
            body: {
              property_id: propertyId,
              agent_profile_id: agentProfile.id,
              bucket: 'disclosures',
              file_path: fileName,
              bounty_id: bountyId || null,
            },
          });
        } catch (err) {
          console.error('Background analysis invocation error:', err);
        }
      })();

      toast({
        title: "Uploaded — Analyzing in Background",
        description: "You can close this window now. We'll notify you when the report is ready.",
      });

      // Notify parent to refresh data
      onSuccess();

    } catch (error: any) {
      console.error('Error uploading disclosure:', error);
      if (progressTimer) window.clearInterval(progressTimer);
      setPhase('idle');
      setUploadProgress(0);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload disclosure",
        variant: "destructive",
      });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload New Disclosure
          </DialogTitle>
          <DialogDescription>
            Upload a disclosure document for a property. You'll earn 10 credits if no disclosure exists for this address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Property Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">Property Address *</Label>
              {addressFromBounty ? (
                <div className="mt-1 p-3 bg-muted rounded-md border">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-medium">Auto-filled from bounty request:</span>
                  </div>
                  <div className="mt-1 font-medium">{fullAddress}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-2 text-xs"
                    onClick={() => {
                      setAddressFromBounty(false);
                      setFullAddress('');
                      setAddress('');
                      setCity('');
                      setState('');
                      setZipCode('');
                      setExistingDisclosure(null);
                    }}
                  >
                    Change Address
                  </Button>
                </div>
              ) : (
                <AddressAutocomplete
                  value={fullAddress}
                  onChange={setFullAddress}
                  onAddressSelect={(addressDetails) => {
                    setFullAddress(addressDetails.full_address);
                    setAddress(addressDetails.street_address);
                    setCity(addressDetails.city);
                    setState(addressDetails.state);
                    setZipCode(addressDetails.zip_code);
                  }}
                  placeholder="Start typing a US address..."
                  className="mt-1"
                />
              )}
            </div>
          </div>

          {/* Existing Disclosure Check */}
          {checkingExisting && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Checking for existing disclosures...
                </div>
              </CardContent>
            </Card>
          )}

          {existingDisclosure && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Disclosure Already Exists</span>
                </div>
                <p className="text-sm text-orange-600 mt-1">
                  A disclosure for this property already exists in the database. You cannot earn credits for duplicate disclosures.
                </p>
              </CardContent>
            </Card>
          )}

          {!existingDisclosure && fullAddress && !checkingExisting && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-700">
                  <Coins className="w-4 h-4" />
                  <span className="font-medium">New Property - Earn 10 Credits!</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  No existing disclosure found. You'll earn 10 credits for uploading this disclosure.
                </p>
              </CardContent>
            </Card>
          )}

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">Disclosure Document (PDF) *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              required
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this disclosure..."
              rows={3}
            />
          </div>

          {phase !== 'idle' && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-muted-foreground">
                {phase === 'uploading' ? 'Uploading to secure storage...' : 'Uploaded — analysis will continue in the background. You can close this window.'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              {phase !== 'idle' ? 'Close' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !!existingDisclosure || phase !== 'idle'}
              className="flex-1"
            >
              {phase === 'uploading' ? 'Uploading...' : 'Upload Disclosure'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
