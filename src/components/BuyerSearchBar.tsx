import { useState } from 'react';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface AddressDetails {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  full_address: string;
}

const BuyerSearchBar = () => {
  const [searchAddress, setSearchAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAddressSelect = async (addressDetails: AddressDetails) => {
    setIsLoading(true);
    try {
      // Search for existing property and disclosure report (same logic as Home page)
      const { data: existingProperty, error: searchError } = await supabase
        .from('properties')
        .select(`
          *,
          disclosure_reports!inner(
            id,
            status,
            report_summary_basic,
            risk_score,
            created_at
          )
        `)
        .ilike('full_address', `%${addressDetails.full_address.trim()}%`)
        .eq('disclosure_reports.status', 'complete')
        .single();

      if (existingProperty && existingProperty.disclosure_reports?.length > 0) {
        // Navigate to existing analysis
        navigate(`/analyze/${existingProperty.id}`);
      } else {
        // No existing analysis, show request form
        navigate(`/analyze/new?address=${encodeURIComponent(addressDetails.full_address)}`);
      }
    } catch (error) {
      console.error('Error searching property:', error);
      // If no existing analysis found, show request form
      navigate(`/analyze/new?address=${encodeURIComponent(addressDetails.full_address)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    const targetAddress = searchAddress.trim();
    
    if (!targetAddress) {
      toast({
        title: "Address Required",
        description: "Please enter a property address to search",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Search for existing property and disclosure report (same logic as Home page)
      const { data: existingProperty, error: searchError } = await supabase
        .from('properties')
        .select(`
          *,
          disclosure_reports!inner(
            id,
            status,
            report_summary_basic,
            risk_score,
            created_at
          )
        `)
        .ilike('full_address', `%${targetAddress}%`)
        .eq('disclosure_reports.status', 'complete')
        .single();

      if (existingProperty && existingProperty.disclosure_reports?.length > 0) {
        // Navigate to existing analysis
        navigate(`/analyze/${existingProperty.id}`);
      } else {
        // No existing analysis, show request form
        navigate(`/analyze/new?address=${encodeURIComponent(targetAddress)}`);
      }
    } catch (error) {
      console.error('Error searching property:', error);
      // If no existing analysis found, show request form
      navigate(`/analyze/new?address=${encodeURIComponent(targetAddress)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold mb-2">Search for Property Disclosures</h2>
            <p className="text-muted-foreground">
              Enter an address to find available disclosure reports and analysis
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="flex-1">
              <AddressAutocomplete
                value={searchAddress}
                onChange={setSearchAddress}
                onAddressSelect={handleAddressSelect}
                placeholder="Enter property address..."
                className="h-12 text-lg"
              />
            </div>
            <Button 
              onClick={handleSearch}
              disabled={!searchAddress.trim() || isLoading}
              size="lg"
              className="px-6"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
};

export default BuyerSearchBar;