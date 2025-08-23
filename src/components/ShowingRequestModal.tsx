import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, Clock, Coins } from 'lucide-react';

interface Property {
  id: string;
  full_address: string;
  city: string;
  state: string;
}

interface ShowingRequestModalProps {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  userCredits: number;
  onRequestSuccess: () => void;
}

export const ShowingRequestModal = ({ 
  property, 
  isOpen, 
  onClose, 
  userCredits, 
  onRequestSuccess 
}: ShowingRequestModalProps) => {
  const { user } = useAuth();
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ [key: string]: string }>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const dateString = date.toISOString().split('T')[0];
    if (selectedDates.some(d => d.toISOString().split('T')[0] === dateString)) {
      // Remove date if already selected
      setSelectedDates(prev => prev.filter(d => d.toISOString().split('T')[0] !== dateString));
      const newTimeSlots = { ...timeSlots };
      delete newTimeSlots[dateString];
      setTimeSlots(newTimeSlots);
    } else {
      // Add new date
      setSelectedDates(prev => [...prev, date]);
    }
  };

  const handleTimeSlotChange = (dateString: string, timeSlot: string) => {
    setTimeSlots(prev => ({
      ...prev,
      [dateString]: timeSlot
    }));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to request a showing.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDates.length === 0) {
      toast({
        title: "Select Dates",
        description: "Please select at least one preferred date.",
        variant: "destructive",
      });
      return;
    }

    if (userCredits < 50) {
      toast({
        title: "Insufficient Credits",
        description: "You need at least 50 credits to request a showing.",
        variant: "destructive",
      });
      return;
    }

    // Check if all selected dates have time slots
    const incompleteDates = selectedDates.filter(date => {
      const dateString = date.toISOString().split('T')[0];
      return !timeSlots[dateString];
    });

    if (incompleteDates.length > 0) {
      toast({
        title: "Time Slots Required",
        description: "Please specify time preferences for all selected dates.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Prepare preferred dates with time slots
      const preferredDates = selectedDates.map(date => {
        const dateString = date.toISOString().split('T')[0];
        return {
          date: dateString,
          timeSlot: timeSlots[dateString]
        };
      });

      // Set refund deadline to 2 hours from now
      const refundDeadline = new Date();
      refundDeadline.setHours(refundDeadline.getHours() + 2);

      // Create showing request
      const { data, error } = await supabase
        .from('showing_requests')
        .insert({
          property_id: property.id,
          requested_by_user_id: user.id,
          preferred_dates: preferredDates,
          preferred_times: notes,
          credits_spent: 50,
          refund_deadline: refundDeadline.toISOString(),
          status: 'bidding'
        })
        .select()
        .single();

      if (error) throw error;

      // Deduct credits from user profile
      const { error: creditError } = await supabase
        .from('profiles')
        .update({
          credits: userCredits - 50
        })
        .eq('user_id', user.id);

      if (creditError) throw creditError;

      toast({
        title: "Showing Request Submitted",
        description: "Your showing request has been submitted. Agents have 2 hours to bid.",
      });

      onRequestSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating showing request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit showing request",
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
            <CalendarIcon className="w-5 h-5" />
            Request Property Showing
          </DialogTitle>
          <DialogDescription>
            {property.full_address}, {property.city}, {property.state}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cost Information */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">Cost: 50 Credits</span>
                </div>
                <Badge variant={userCredits >= 50 ? "default" : "destructive"}>
                  Your Balance: {userCredits} Credits
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Credits will be refunded if no agent accepts within 2 hours
              </p>
            </CardContent>
          </Card>

          {/* Date Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Select Preferred Dates</Label>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={(dates) => dates && setSelectedDates(dates)}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
            
            {selectedDates.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-medium">Time Preferences</Label>
                {selectedDates.map((date) => {
                  const dateString = date.toISOString().split('T')[0];
                  return (
                    <div key={dateString} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <CalendarIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          {date.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <Clock className="w-4 h-4" />
                        <Input
                          placeholder="e.g., 2:00 PM - 4:00 PM"
                          value={timeSlots[dateString] || ''}
                          onChange={(e) => handleTimeSlotChange(dateString, e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any specific requirements or preferences..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              disabled={loading || userCredits < 50 || selectedDates.length === 0}
              className="flex-1"
            >
              {loading ? "Submitting..." : "Submit Request (50 Credits)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};