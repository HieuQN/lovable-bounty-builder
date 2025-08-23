import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CalendarIcon, Clock, Coins, Zap } from 'lucide-react';

interface ShowingRequest {
  id: string;
  property_id: string;
  preferred_dates: any;
  preferred_times: string;
  refund_deadline: string;
  credits_spent: number;
  properties?: {
    full_address: string;
    city: string;
    state: string;
  };
}

interface ShowingBidModalProps {
  showingRequest: ShowingRequest;
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  onBidSuccess: () => void;
}

export const ShowingBidModal = ({ 
  showingRequest, 
  agentId, 
  isOpen, 
  onClose, 
  onBidSuccess 
}: ShowingBidModalProps) => {
  const [bidAmount, setBidAmount] = useState<number>(20);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const timeRemaining = () => {
    const now = new Date();
    const deadline = new Date(showingRequest.refund_deadline);
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const isInstantClaim = bidAmount >= 50;

  const handleSubmit = async () => {
    if (!selectedTimeSlot) {
      toast({
        title: "Time Slot Required",
        description: "Please select a time slot for the showing.",
        variant: "destructive",
      });
      return;
    }

    if (bidAmount < 20) {
      toast({
        title: "Invalid Bid",
        description: "Minimum bid amount is 20 credits.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('showing_bids')
        .insert({
          showing_request_id: showingRequest.id,
          bidding_agent_id: agentId,
          bid_amount: bidAmount,
          selected_time_slot: selectedTimeSlot,
        })
        .select()
        .single();

      if (error) throw error;

      if (isInstantClaim) {
        toast({
          title: "Showing Claimed!",
          description: "Your bid of 50+ credits instantly won the showing.",
        });
      } else {
        toast({
          title: "Bid Submitted",
          description: `Your bid of ${bidAmount} credits has been submitted.`,
        });
      }

      onBidSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error submitting bid:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit bid",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const preferredDates = showingRequest.preferred_dates || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Bid on Showing Request
          </DialogTitle>
          <DialogDescription>
            {showingRequest.properties?.full_address}, {showingRequest.properties?.city}, {showingRequest.properties?.state}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Time Remaining */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">Bidding Window</span>
                </div>
                <Badge variant="secondary">
                  {timeRemaining()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Available Time Slots */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Select Available Time Slot</Label>
            <RadioGroup value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
              {preferredDates.map((dateSlot: any, index: number) => (
                <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <RadioGroupItem value={`${dateSlot.date} ${dateSlot.timeSlot}`} id={`slot-${index}`} />
                  <Label htmlFor={`slot-${index}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="w-4 h-4" />
                      <span className="font-medium">
                        {new Date(dateSlot.date).toLocaleDateString()}
                      </span>
                      <Clock className="w-4 h-4" />
                      <span>{dateSlot.timeSlot}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            {showingRequest.preferred_times && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Additional Notes:</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {showingRequest.preferred_times}
                </p>
              </div>
            )}
          </div>

          {/* Bid Amount */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Your Bid Amount</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <Input
                    type="number"
                    min="20"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">Credits</span>
                </div>
                
                {isInstantClaim && (
                  <Badge className="bg-green-500 text-white">
                    <Zap className="w-3 h-3 mr-1" />
                    Instant Claim
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Minimum Bid</div>
                      <div className="text-lg font-bold text-orange-500">20 Credits</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Instant Claim</div>
                      <div className="text-lg font-bold text-green-500">50 Credits</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {bidAmount < 50 
                  ? "You can adjust your bid anytime during the 2-hour window"
                  : "This bid will instantly win the showing request"
                }
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !selectedTimeSlot}
              className="flex-1"
            >
              {loading ? "Submitting..." : isInstantClaim ? "Claim Instantly" : "Submit Bid"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};