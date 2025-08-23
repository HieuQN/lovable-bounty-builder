import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Shield, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

const Home = () => {
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAnalyze = async (addressToAnalyze?: string) => {
    const targetAddress = addressToAnalyze || address;
    
    if (!targetAddress.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter a property address to analyze",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // First try to find existing property by searching for similar addresses
      const { data: existingProperty, error: searchError } = await supabase
        .from('properties')
        .select('*')
        .ilike('full_address', `%${targetAddress.trim()}%`)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        throw searchError;
      }

      let propertyId;

      if (existingProperty) {
        propertyId = existingProperty.id;
      } else {
        // Create new property with structured address data if available
        const insertData = addressDetails ? {
          full_address: targetAddress.trim(),
          street_address: addressDetails.street_address || targetAddress.trim(),
          city: addressDetails.city || 'Unknown',
          state: addressDetails.state || 'Unknown',
          zip_code: addressDetails.zip_code || '00000'
        } : {
          full_address: targetAddress.trim(),
          street_address: targetAddress.trim(),
          city: 'Unknown',
          state: 'Unknown',
          zip_code: '00000'
        };

        const { data: newProperty, error: createError } = await supabase
          .from('properties')
          .insert(insertData)
          .select('id')
          .single();

        if (createError) throw createError;
        propertyId = newProperty.id;
      }

      navigate(`/analyze/${propertyId}`);
    } catch (error) {
      console.error('Error creating property:', error);
      toast({
        title: "Error",
        description: "Failed to process property address",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Property Intelligence
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            InsightHome
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Get instant analysis of property disclosure reports. Uncover potential issues, 
            estimate costs, and gain negotiation advantages before you buy.
          </p>
          
          {/* Address Input */}
          <Card className="max-w-2xl mx-auto mb-12">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onAddressSelect={(addressDetails) => {
                      setAddress(addressDetails.full_address);
                      setAddressDetails(addressDetails);
                      // Auto-trigger analysis with the full formatted address
                      handleAnalyze(addressDetails.full_address);
                    }}
                    placeholder="Enter a property address to analyze..."
                    className="text-lg h-12"
                  />
                </div>
                <Button 
                  onClick={() => handleAnalyze()}
                  disabled={loading}
                  size="lg"
                  className="h-12 px-8"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Analyze Property
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <Shield className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle>Risk Assessment</CardTitle>
              <CardDescription>
                AI-powered analysis identifies potential issues in foundation, electrical, plumbing, and more
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle>Cost Estimates</CardTitle>
              <CardDescription>
                Get realistic repair cost ranges to factor into your negotiation strategy
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
              <CardTitle>Agent Network</CardTitle>
              <CardDescription>
              Licensed real estate agents upload disclosures and earn credits for verified reports.
              <br /><a href="/agent-dashboard" className="text-primary hover:underline font-medium">Agent Login →</a>
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our simple 3-step process gets you property insights in minutes
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
            <h3 className="font-semibold mb-2">Enter Address</h3>
            <p className="text-muted-foreground">Search for any property in Newtown, CT</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
            <h3 className="font-semibold mb-2">AI Analysis</h3>
            <p className="text-muted-foreground">Our AI reviews disclosure documents and identifies key issues</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
            <h3 className="font-semibold mb-2">Get Insights</h3>
            <p className="text-muted-foreground">Receive detailed analysis with cost estimates and negotiation tips</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;