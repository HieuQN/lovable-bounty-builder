import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Eye, ShoppingCart, Calendar, MessageCircle, Clock } from 'lucide-react';
import { useShowingStatus } from '@/hooks/useShowingStatus';

interface PropertyCardProps {
  report: any;
  propertyInfo: {
    address: string;
    details: string;
    location: string;
  };
  riskCounts: {
    high: number;
    medium: number;
    low: number;
    examples: { high: string; medium: string; low: string };
  };
  onViewReport: () => void;
  onDownload?: () => void;
  onPurchase?: () => void;
  onRequestShowing: () => void;
  onOpenChat?: () => void;
  isPurchased?: boolean;
}

export const PropertyCard = ({
  report,
  propertyInfo,
  riskCounts,
  onViewReport,
  onDownload,
  onPurchase,
  onRequestShowing,
  onOpenChat,
  isPurchased = false
}: PropertyCardProps) => {
  const { showingStatus, getButtonState } = useShowingStatus(report.property_id);
  const buttonState = getButtonState();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              {propertyInfo.address}
            </CardTitle>
            <CardDescription className="font-medium">
              {propertyInfo.details}
            </CardDescription>
            <CardDescription className="text-xs">
              {propertyInfo.location} • {isPurchased ? 'Purchased' : 'Added'} on {new Date(report.created_at).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isPurchased && (
              <Badge variant="default">
                <CheckCircle className="w-3 h-3 mr-1" />
                Purchased
              </Badge>
            )}
            {!isPurchased && (
              <Badge variant="secondary">Available</Badge>
            )}
            <Badge variant="outline">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(report.created_at).toLocaleDateString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Risk Assessment */}
        <div className="mb-4">
          {isPurchased || report.is_purchased ? (
            <div>
              <h4 className="font-medium mb-2">Risk Assessment Summary:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between">
                  <span className="text-red-600">• High Risk Issues:</span>
                  <span className="font-medium">{riskCounts.high} items</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-yellow-600">• Medium Risk Issues:</span>
                  <span className="font-medium">{riskCounts.medium} items</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-green-600">• Low Risk Issues:</span>
                  <span className="font-medium">{riskCounts.low} items</span>
                </li>
              </ul>
            </div>
          ) : (
            <div>
              <h4 className="font-medium mb-2">Free Analysis Preview:</h4>
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{riskCounts.high}</div>
                  <div className="text-xs text-muted-foreground">High Risk</div>
                  <div className="text-xs mt-1 font-medium">Ex: {riskCounts.examples.high}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{riskCounts.medium}</div>
                  <div className="text-xs text-muted-foreground">Medium Risk</div>
                  <div className="text-xs mt-1 font-medium">Ex: {riskCounts.examples.medium}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{riskCounts.low}</div>
                  <div className="text-xs text-muted-foreground">Low Risk</div>
                  <div className="text-xs mt-1 font-medium">Ex: {riskCounts.examples.low}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* View/Purchase Button */}
          {isPurchased || report.is_purchased ? (
            <Button size="sm" onClick={onViewReport}>
              <Eye className="w-4 h-4 mr-2" />
              View Report
            </Button>
          ) : (
            <Button size="sm" onClick={onPurchase}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Purchase Report
            </Button>
          )}

          {/* Download Button (for purchased reports) */}
          {(isPurchased || report.is_purchased) && onDownload && (
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}

          {/* Showing Request/Chat Button */}
          {buttonState.canChat && onOpenChat ? (
            <Button size="sm" variant="outline" onClick={onOpenChat}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat with Agent
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant={buttonState.variant}
              onClick={onRequestShowing}
              disabled={buttonState.disabled}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {buttonState.text}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};