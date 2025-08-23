import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Upload, MapPin, Coins, AlertCircle } from 'lucide-react';

interface UploadDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export const UploadDisclosureModal = ({ 
  isOpen, 
  onClose, 
  onUploadSuccess 
}: UploadDisclosureModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [notes, setNotes] = useState('');
  const [existingDisclosure, setExistingDisclosure] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  const checkForExistingDisclosure = async () => {
    if (!address || !city || !state) return;
    
    setCheckingExisting(true);
    try {
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .ilike('full_address', `%${address}%`)
        .ilike('city', `%${city}%`)
        .ilike('state', `%${state}%`);

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
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file || !address || !city || !state || !zipCode) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and select a file",
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

    try {
      // Get agent profile
      const { data: agentProfile, error: agentError } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (agentError) throw agentError;

      // Create or get property
      const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
      
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

      // Get file URL
      const { data: urlData } = supabase.storage
        .from('disclosures')
        .getPublicUrl(fileName);

      // Create disclosure report
      const { error: reportError } = await supabase
        .from('disclosure_reports')
        .insert({
          property_id: propertyId,
          uploaded_by_agent_id: agentProfile.id,
          raw_pdf_url: urlData.publicUrl,
          status: 'complete',
          report_summary_basic: notes || 'Disclosure document uploaded',
          dummy_analysis_complete: true
        });

      if (reportError) throw reportError;

      toast({
        title: "Disclosure Uploaded Successfully!",
        description: "You've earned 10 credits for this new disclosure",
      });

      onUploadSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error uploading disclosure:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload disclosure",
        variant: "destructive",
      });
    } finally {
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={checkForExistingDisclosure}
                placeholder="123 Main Street"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onBlur={checkForExistingDisclosure}
                placeholder="Anytown"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                onBlur={checkForExistingDisclosure}
                placeholder="CT"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code *</Label>
              <Input
                id="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="06810"
                required
              />
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

          {!existingDisclosure && address && city && state && !checkingExisting && (
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

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !!existingDisclosure}
              className="flex-1"
            >
              {loading ? "Uploading..." : "Upload Disclosure"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
