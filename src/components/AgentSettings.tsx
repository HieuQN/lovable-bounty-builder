import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { User, Building, Star, MapPin, Phone, Mail } from 'lucide-react';

interface AgentProfile {
  id: string;
  user_id: string;
  credit_balance: number;
  license_number: string;
  brokerage_name: string;
  service_areas: string[];
  profile_bio: string;
  profile_photo_url: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  phone_number: string;
}

const AgentSettings = () => {
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    phone_number: '',
    license_number: '',
    brokerage_name: '',
    profile_bio: '',
    service_areas: '',
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user profile
      const { data: userProfileData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (userError) throw userError;

      // Fetch agent profile
      const { data: agentProfileData, error: agentError } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (agentError && agentError.code !== 'PGRST116') throw agentError;

      setUserProfile(userProfileData);
      setAgentProfile(agentProfileData);

      // Set form data
      setFormData({
        first_name: userProfileData?.first_name || '',
        phone_number: userProfileData?.phone_number || '',
        license_number: agentProfileData?.license_number || '',
        brokerage_name: agentProfileData?.brokerage_name || '',
        profile_bio: agentProfileData?.profile_bio || '',
        service_areas: agentProfileData?.service_areas?.join(', ') || '',
      });
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load profile settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update user profile
      const { error: userError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.first_name,
          phone_number: formData.phone_number,
        })
        .eq('user_id', user.id);

      if (userError) throw userError;

      // Update or create agent profile
      const agentData = {
        license_number: formData.license_number,
        brokerage_name: formData.brokerage_name,
        profile_bio: formData.profile_bio,
        service_areas: formData.service_areas.split(',').map(area => area.trim()).filter(Boolean),
      };

      if (agentProfile) {
        const { error: agentError } = await supabase
          .from('agent_profiles')
          .update(agentData)
          .eq('user_id', user.id);

        if (agentError) throw agentError;
      } else {
        const { error: agentError } = await supabase
          .from('agent_profiles')
          .insert({
            user_id: user.id,
            ...agentData,
          });

        if (agentError) throw agentError;
      }

      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully",
      });

      fetchProfiles();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-10 bg-muted rounded"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={userProfile?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="Enter your phone number"
              />
            </div>
          </CardContent>
        </Card>

        {/* Professional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Professional Information
            </CardTitle>
            <CardDescription>
              Update your real estate license and brokerage details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <Input
                id="license_number"
                value={formData.license_number}
                onChange={(e) => setFormData(prev => ({ ...prev, license_number: e.target.value }))}
                placeholder="Enter your license number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brokerage_name">Brokerage Name</Label>
              <Input
                id="brokerage_name"
                value={formData.brokerage_name}
                onChange={(e) => setFormData(prev => ({ ...prev, brokerage_name: e.target.value }))}
                placeholder="Enter your brokerage name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_areas">Service Areas</Label>
              <Input
                id="service_areas"
                value={formData.service_areas}
                onChange={(e) => setFormData(prev => ({ ...prev, service_areas: e.target.value }))}
                placeholder="e.g., San Francisco, Oakland, Berkeley"
              />
              <p className="text-xs text-muted-foreground">Separate multiple areas with commas</p>
            </div>
          </CardContent>
        </Card>

        {/* Profile & Bio */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Profile & Bio
            </CardTitle>
            <CardDescription>
              Tell clients about yourself and your expertise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile_bio">Professional Bio</Label>
              <Textarea
                id="profile_bio"
                value={formData.profile_bio}
                onChange={(e) => setFormData(prev => ({ ...prev, profile_bio: e.target.value }))}
                placeholder="Tell clients about your experience, specialties, and what makes you unique..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Stats */}
        {agentProfile && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
              <CardDescription>
                Your current account status and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{agentProfile.credit_balance}</div>
                  <div className="text-sm text-muted-foreground">Credits Available</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {agentProfile.service_areas?.length || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Service Areas</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">Active</div>
                  <div className="text-sm text-muted-foreground">Account Status</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default AgentSettings;