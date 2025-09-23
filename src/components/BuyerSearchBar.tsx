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
      // First, check if property already exists
      const { data: existingProperty, error: searchError } = await supabase
        .from('properties')
        .select('id')
        .eq('full_address', addressDetails.full_address)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      let propertyId = existingProperty?.id;

      // If property doesn't exist, create it
      if (!existingProperty) {
        const { data: newProperty, error: insertError } = await supabase
          .from('properties')
          .insert({
            full_address: addressDetails.full_address,
            street_address: addressDetails.street_address,
            city: addressDetails.city,
            state: addressDetails.state,
            zip_code: addressDetails.zip_code,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        propertyId = newProperty.id;
      }

      // Check if there are any disclosure reports for this property
      const { data: reports, error: reportsError } = await supabase
        .from('disclosure_reports')
        .select('id, status')
        .eq('property_id', propertyId);

      if (reportsError) throw reportsError;

      if (reports && reports.length > 0) {
        // Navigate to reports or analysis page
        navigate('/analyze', { 
          state: { 
            address: addressDetails.full_address,
            propertyId: propertyId
          } 
        });
      } else {
        // No reports available, show message and maybe navigate to request page
        toast({
          title: "No Reports Available",
          description: `No disclosure reports found for ${addressDetails.full_address}. You can request a showing or check back later.`,
        });
        
        navigate('/analyze', { 
          state: { 
            address: addressDetails.full_address,
            propertyId: propertyId,
            noReports: true
          } 
        });
      }

    } catch (error) {
      console.error('Error handling address search:', error);
      toast({
        title: "Error",
        description: "Failed to search for property. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchAddress.trim()) {
      // If user types without selecting from dropdown, still try to process
      navigate('/analyze', { 
        state: { 
          address: searchAddress.trim(),
          manual: true
        } 
      });
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
          
          <div className="flex items-center justify-center mt-3 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mr-1" />
            <span>Powered by Google Places API</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BuyerSearchBar;