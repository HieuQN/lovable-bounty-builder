import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Shield, TrendingUp, Users, ArrowRight, CheckCircle, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import ProfessionalNavigation from '@/components/ProfessionalNavigation';

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

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to request property analysis",
        variant: "destructive",
      });
      navigate('/auth');
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

      // Create disclosure bounty for the property
      const { error: bountyError } = await supabase
        .from('disclosure_bounties')
        .insert({
          property_id: propertyId,
          requested_by_user_id: user.id,
          status: 'open'
        });

      if (bountyError) {
        console.error('Error creating bounty:', bountyError);
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
    <div className="min-h-screen">
      <ProfessionalNavigation />
      
      <div className="hero-section">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              <Star className="w-4 h-4 mr-2" />
              AI-Powered Property Intelligence
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
              Smart Property{" "}
              <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
                Disclosure
              </span>{" "}
              Analysis
            </h1>
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-3xl mx-auto">
              Get instant AI analysis of property disclosure reports. Uncover potential issues, 
              estimate costs, and gain negotiation advantages before you buy.
            </p>
            
            {/* Address Input */}
            <Card className="max-w-3xl mx-auto mb-16 card-gradient border-0">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <AddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      onAddressSelect={(addressDetails) => {
                        setAddress(addressDetails.full_address);
                        setAddressDetails(addressDetails);
                        handleAnalyze(addressDetails.full_address);
                      }}
                      placeholder="Enter a property address to analyze..."
                      className="text-lg h-14 border-0 bg-background/50 backdrop-blur-sm"
                    />
                  </div>
                  <Button 
                    onClick={() => handleAnalyze()}
                    disabled={loading}
                    size="lg"
                    className="h-14 px-10 btn-primary text-lg font-semibold"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-3" />
                        Analyze Property
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground mb-16">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>AI-Powered Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Instant Results</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Professional Grade</span>
              </div>
            </div>
          </div>
        </section>
      </div>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose IntelleHouse?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our AI-powered platform gives you the insights you need to make confident property decisions
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="text-center card-gradient border-0 group hover:scale-105 transition-transform duration-300">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">Risk Assessment</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  AI-powered analysis identifies potential issues in foundation, electrical, plumbing, and structural systems
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center card-gradient border-0 group hover:scale-105 transition-transform duration-300">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">Cost Estimates</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Get realistic repair cost ranges and budget planning to factor into your negotiation strategy
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center card-gradient border-0 group hover:scale-105 transition-transform duration-300">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-2">Agent Network</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Licensed real estate agents upload disclosures and earn credits for verified reports
                  <br />
                  <Button variant="link" className="p-0 h-auto text-primary font-semibold mt-2" asChild>
                    <a href="/auth">
                      Agent Login <ArrowRight className="w-4 h-4 ml-1" />
                    </a>
                  </Button>
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our simple 3-step process gets you property insights in minutes
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform">
                1
              </div>
              <h3 className="text-xl font-semibold mb-3">Enter Address</h3>
              <p className="text-muted-foreground leading-relaxed">
                Search for any property address using our intelligent autocomplete system
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform">
                2
              </div>
              <h3 className="text-xl font-semibold mb-3">AI Analysis</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our advanced AI reviews disclosure documents and identifies key issues and risks
              </p>
            </div>
            
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform">
                3
              </div>
              <h3 className="text-xl font-semibold mb-3">Get Insights</h3>
              <p className="text-muted-foreground leading-relaxed">
                Receive detailed analysis with cost estimates, risk assessment, and negotiation tips
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Make Smarter Property Decisions?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of buyers and agents who trust IntelleHouse for property insights
          </p>
          <Button size="lg" className="btn-primary text-lg px-8 py-6" asChild>
            <a href="#top">
              Get Started Today <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;