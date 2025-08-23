import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddressSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressDetails {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  full_address: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: AddressDetails) => void;
  placeholder?: string;
  className?: string;
}

export const AddressAutocomplete = ({ 
  value, 
  onChange, 
  onAddressSelect,
  placeholder = "Enter address...",
  className = ""
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('places-autocomplete', {
        body: { input, types: 'address' }
      });

      if (error) throw error;
      
      if (data.predictions) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlaceDetails = async (placeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('places-details', {
        body: { 
          place_id: placeId,
          fields: 'address_components,formatted_address'
        }
      });

      if (error) throw error;
      
      if (data.result) {
        const addressComponents = data.result.address_components;
        const addressDetails = parseAddressComponents(addressComponents, data.result.formatted_address);
        
        if (onAddressSelect) {
          onAddressSelect(addressDetails);
        }
        
        onChange(addressDetails.full_address);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  const parseAddressComponents = (components: any[], formattedAddress: string): AddressDetails => {
    let street_number = '';
    let route = '';
    let city = '';
    let state = '';
    let zip_code = '';

    components.forEach((component) => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        street_number = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality')) {
        city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      } else if (types.includes('postal_code')) {
        zip_code = component.long_name;
      }
    });

    const street_address = `${street_number} ${route}`.trim();

    return {
      street_address,
      city,
      state,
      zip_code,
      full_address: formattedAddress
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced search
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    getPlaceDetails(suggestion.place_id);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={`pr-10 ${className}`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto">
          <CardContent className="p-0">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion.place_id}
                variant="ghost"
                className="w-full justify-start p-3 h-auto text-left"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {suggestion.structured_formatting.main_text}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {suggestion.structured_formatting.secondary_text}
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};