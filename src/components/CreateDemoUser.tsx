import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Briefcase } from 'lucide-react';

export const CreateDemoUser = () => {
  const [loading, setLoading] = useState(false);

  const createDemoAccounts = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('create-demo-user');
      
      if (error) throw error;

      toast({
        title: "Demo Accounts Created!",
        description: `Buyer: demo@intellehouse.com | Agent: agent@intellehouse.com | Password: demo123`,
      });
    } catch (error: any) {
      console.error('Error creating demo accounts:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create demo accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Create Demo Accounts
        </CardTitle>
        <CardDescription>
          Create both buyer and agent demo accounts for testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span><strong>Buyer:</strong> demo@intellehouse.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span><strong>Agent:</strong> agent@intellehouse.com</span>
          </div>
          <div>
            <span><strong>Password:</strong> demo123</span>
          </div>
        </div>
        <Button 
          onClick={createDemoAccounts} 
          disabled={loading}
          className="w-full"
        >
          {loading ? "Creating..." : "Create Demo Accounts"}
        </Button>
      </CardContent>
    </Card>
  );
};