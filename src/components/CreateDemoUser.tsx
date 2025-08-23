import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

const CreateDemoUser = () => {
  const [creating, setCreating] = useState(false);

  const createDemoUser = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-demo-user');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Demo User Created!",
        description: "You can now use the demo account: demo@intellehouse.com / demo123",
      });
    } catch (error: any) {
      console.error('Error creating demo user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create demo user",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Button 
      onClick={createDemoUser} 
      disabled={creating}
      variant="secondary"
      size="sm"
    >
      {creating ? "Creating..." : "Create Demo User"}
    </Button>
  );
};

export default CreateDemoUser;