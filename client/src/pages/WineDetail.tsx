import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { VintageStock, Wine } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Header from "@/components/ui/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Star } from "lucide-react";
import StockLevelControl from "@/components/StockLevelControl";
import VintageManager from "@/components/VintageManager";
import { getCategoryColor, getVintageApplicableCategories } from "@/lib/wine-categories";

export default function WineDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/wine/:id");
  const { toast } = useToast();
  const id = params?.id ? parseInt(params.id) : null;
  
  // Main wine data states
  const [vintageStocks, setVintageStocks] = useState<VintageStock[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  
  // Additional editable fields
  const [name, setName] = useState("");
  const [wineType, setWineType] = useState<string | null>(null);
  const [subType, setSubType] = useState<string | null>(null);
  const [producer, setProducer] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  
  const isVintageApplicable = (category?: string) => {
    if (!category) return false;
    return getVintageApplicableCategories().includes(category as any);
  };
  
  // Fetch the specific wine directly
  const { data: wine, isLoading, isError } = useQuery({
    queryKey: [`/api/wines/${id}`],
    queryFn: async () => {
      if (!id) return null;
      
      try {
        const response = await fetch(`/api/wines/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch wine: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching wine:", error);
        throw error;
      }
    },
    enabled: !!id
  });
  
  // Update local state when the wine data changes
  useEffect(() => {
    if (wine) {
      console.log("Wine data loaded:", wine);
      
      // Set main wine details
      setName(wine.name || "");
      setWineType(wine.wine || "");
      setSubType(wine.subType || "");
      setProducer(wine.producer || "");
      setRegion(wine.region || "");
      setCountry(wine.country || "");
      
      // Set vintage stocks, ensuring it's an array
      const stocks = Array.isArray(wine.vintageStocks) ? wine.vintageStocks : [];
      setVintageStocks(stocks);
      
      // Calculate total stock based on whether we're using vintages or not
      let total = 0;
      if (isVintageApplicable(wine.category) && stocks.length > 0) {
        total = stocks.reduce((sum, vs) => sum + vs.stock, 0);
      } else {
        total = wine.stockLevel || 0;
      }
      setTotalStock(total);
      
      // Set notes (prioritize notes field, fall back to description if needed)
      const noteText = wine.notes || wine.description || "";
      setNotes(noteText);
      
      // Set rating
      setRating(wine.rating !== null && wine.rating !== undefined ? wine.rating : null);
    }
  }, [wine]);
  
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Wine>) => 
      apiRequest("PATCH", `/api/wines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wines/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/wines"] });
      toast({
        title: "Bottle Updated",
        description: "Your changes have been saved.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/wines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wines"] });
      toast({
        title: "Bottle Removed",
        description: "The bottle has been removed from your collection.",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
      });
    },
  });
  
  const handleStockChange = (newStock: number) => {
    setTotalStock(newStock);
    
    if (!isVintageApplicable(wine?.category)) {
      updateMutation.mutate({ stockLevel: newStock });
    }
  };
  
  const handleVintageStocksChange = (newVintageStocks: VintageStock[]) => {
    setVintageStocks(newVintageStocks);
    const newTotalStock = newVintageStocks.reduce((sum, v) => sum + v.stock, 0);
    setTotalStock(newTotalStock);
    
    updateMutation.mutate({ 
      vintageStocks: newVintageStocks, 
      stockLevel: newTotalStock 
    });
  };
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };
  
  const handleSaveNotes = () => {
    updateMutation.mutate({ notes });
  };
  
  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
    updateMutation.mutate({ rating: newRating });
  };
  
  const handleDelete = () => {
    deleteMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <Header title="Bottle Details" />
        <main className="flex-1 container px-4 py-6 mx-auto">
          <div className="max-w-2xl mx-auto bg-muted h-96 rounded-lg animate-pulse"></div>
        </main>
      </div>
    );
  }
  
  if (isError || !wine) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <Header title="Error" />
        <main className="flex-1 container px-4 py-6 mx-auto">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold text-destructive mb-2">Wine Not Found</h2>
              <p>This wine may have been removed from your collection.</p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Return to Collection
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }
  
  // Handle form field changes
  const handleFieldChange = (field: string, value: string | null) => {
    switch (field) {
      case 'name':
        setName(value as string);
        break;
      case 'wine':
        setWineType(value);
        break;
      case 'subType':
        setSubType(value);
        break;
      case 'producer':
        setProducer(value);
        break;
      case 'region':
        setRegion(value);
        break;
      case 'country':
        setCountry(value);
        break;
    }
  };
  
  // Save all edited fields
  const handleSaveDetails = () => {
    updateMutation.mutate({
      name,
      wine: wineType,
      subType,
      producer,
      region,
      country
    });
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      <Header title={wine.name} />
      
      <main className="flex-1 container px-4 py-6 mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/")} className="pl-0">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Collection
          </Button>
        </div>
        
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  style={{ backgroundColor: getCategoryColor(wine.category) }}
                >
                  {wine.category}
                </Badge>
                {/* Show individual vintage badges */}
                {vintageStocks.length > 0 && vintageStocks.map(vs => (
                  <Badge key={vs.vintage} variant="outline">{vs.vintage}</Badge>
                ))}
              </div>
              
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="text-2xl font-bold w-full border-b border-primary focus:outline-none mb-2"
                />
              ) : (
                <CardTitle className="text-2xl">{wine.name}</CardTitle>
              )}
              
              {isEditing ? (
                <input
                  type="text"
                  value={producer || ''}
                  onChange={(e) => handleFieldChange('producer', e.target.value)}
                  placeholder="Producer"
                  className="text-muted-foreground w-full focus:outline-none"
                />
              ) : (
                wine.producer && <p className="text-muted-foreground">{wine.producer}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant={isEditing ? "default" : "outline"} 
                size="icon" 
                onClick={() => {
                  if (isEditing) {
                    handleSaveDetails();
                  }
                  setIsEditing(!isEditing);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove from Collection?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {wine.name} from your collection? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 gap-6">
              {/* Wine Information Section */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Wine Details</h3>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Wine Type:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={wineType || ''}
                          onChange={(e) => handleFieldChange('wine', e.target.value)}
                          placeholder="Wine Type"
                          className="text-sm p-1 border rounded w-1/2 text-right"
                        />
                      ) : (
                        <span className="text-sm">{wine.wine || 'Not specified'}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Sub-Type:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={subType || ''}
                          onChange={(e) => handleFieldChange('subType', e.target.value)}
                          placeholder="Sub-Type"
                          className="text-sm p-1 border rounded w-1/2 text-right"
                        />
                      ) : (
                        <span className="text-sm">{wine.subType || 'Not specified'}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Region:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={region || ''}
                          onChange={(e) => handleFieldChange('region', e.target.value)}
                          placeholder="Region"
                          className="text-sm p-1 border rounded w-1/2 text-right"
                        />
                      ) : (
                        <span className="text-sm">{wine.region || 'Not specified'}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Country:</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={country || ''}
                          onChange={(e) => handleFieldChange('country', e.target.value)}
                          placeholder="Country"
                          className="text-sm p-1 border rounded w-1/2 text-right"
                        />
                      ) : (
                        <span className="text-sm">{wine.country || 'Not specified'}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Your Collection</h3>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Total Stock:</span>
                      <span className="text-sm font-bold">{totalStock} bottles</span>
                    </div>
                    {isVintageApplicable(wine.category) && vintageStocks.length > 0 && (
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium">Vintages:</span>
                        <div className="text-sm text-right">
                          {vintageStocks.sort((a, b) => a.vintage - b.vintage).map((vs, index) => (
                            <div key={vs.vintage}>
                              {vs.vintage}: {vs.stock} bottle{vs.stock !== 1 ? 's' : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Added on:</span>
                      <span className="text-sm">
                        {wine.createdAt && typeof wine.createdAt === 'string' 
                          ? new Date(wine.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Recently added'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Notes & Rating Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Your Notes</h3>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea 
                          value={notes} 
                          onChange={handleNotesChange} 
                          placeholder="Add your tasting notes, impressions, or pairing ideas..." 
                          rows={4}
                        />
                        <Button size="sm" onClick={handleSaveNotes}>Save Notes</Button>
                      </div>
                    ) : (
                      <div 
                        className="p-3 border rounded-md min-h-[100px] text-sm"
                        onClick={() => setIsEditing(true)}
                      >
                        {notes || "Click to add notes..."}
                      </div>
                    )}
                  </div>
                  
                  {/* Rating implementation */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Your Rating</h3>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button 
                          key={star} 
                          onClick={() => handleRatingChange(star)}
                          className={`text-lg ${
                            (rating !== null && star <= rating) 
                              ? 'text-yellow-500' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          <Star className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Inventory Management Section */}
                <div className="bg-muted p-4 rounded-md">
                  <h3 className="font-medium mb-4">Inventory Management</h3>
                  
                  {!isVintageApplicable(wine.category) ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Stock:</span>
                        <span className="text-xl font-bold">{totalStock}</span>
                      </div>
                      <StockLevelControl 
                        value={totalStock}
                        onChange={handleStockChange}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Bottles:</span>
                        <span className="text-xl font-bold">{totalStock}</span>
                      </div>
                      <VintageManager 
                        vintageStocks={vintageStocks}
                        onChange={handleVintageStocksChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}