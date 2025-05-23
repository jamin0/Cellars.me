import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { WineCatalog } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, X, Plus } from "lucide-react";

interface SearchWineProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchWine({ value, onChange }: SearchWineProps) {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: searchResults, isLoading } = useQuery<WineCatalog[]>({
    queryKey: ["/api/catalog/search", searchTerm],
    queryFn: async () => {
      const res = await fetch(
        `/api/catalog/search?q=${encodeURIComponent(searchTerm)}`,
      );
      if (!res.ok) throw new Error("Failed to search catalog");
      return res.json();
    },
    enabled: searchTerm.length > 2,
  });

  // Handle selection of a wine from catalog
  const handleSelectWine = (wine: WineCatalog) => {
    // Navigate to add wine page with selected wine data
    const cleanWine = {
      id: wine.id,
      name: wine.name,
      category: wine.category,
      wine: wine.wine, // Include wine type
      subType: wine.subType, // Include sub-type
      producer: wine.producer,
      region: wine.region,
      country: wine.country,
    };

    // Log the wine being selected
    console.log("Selected wine for add form:", cleanWine);

    // Use localStorage to help pass the data reliably
    localStorage.setItem("selected_wine", JSON.stringify(cleanWine));

    // Navigate to add wine page
    navigate(`/add`);
    setOpen(false);
  };

  const clearSearch = () => {
    onChange("");
    setSearchTerm("");
  };

  return (
    <div className="fixed bottom-4 left-0 right-0 z-10 mx-auto max-w-xl">
      <div className="mx-4 bg-background rounded-lg shadow-lg border p-2">
        <div className="relative">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for bottles to add..."
            className="pl-10 pr-10"
            onClick={() => setOpen(true)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="p-0 max-w-xl">
              <div className="p-4">
                <Input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for bottles to add..."
                  className="pl-10"
                />
                <Search className="absolute left-7 top-[2.1rem] h-4 w-4 text-muted-foreground" />
              </div>

              <Command className="rounded-t-none border-t">
                <CommandList>
                  {searchTerm.length <= 2 ? (
                    <CommandEmpty>
                      Type at least 3 characters to search
                    </CommandEmpty>
                  ) : isLoading ? (
                    <CommandEmpty>Searching...</CommandEmpty>
                  ) : searchResults?.length === 0 ? (
                    <CommandEmpty>
                      <div className="p-4 text-center">
                        <p>No matches found. Add a custom bottle instead?</p>
                        <Button
                          className="mt-2"
                          onClick={() => {
                            setOpen(false);
                            navigate("/add");
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Custom Bottle
                        </Button>
                      </div>
                    </CommandEmpty>
                  ) : (
                    <CommandGroup heading="Results">
                      {searchResults?.slice(0, 10).map((wine) => (
                        <CommandItem
                          key={wine.id}
                          onSelect={() => handleSelectWine(wine)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col py-1">
                            <span className="font-medium">{wine.name}</span>
                            <div className="flex text-xs text-muted-foreground gap-1">
                              {wine.wine && <span>{wine.wine}</span>}
                              {wine.wine && (wine.subType || wine.producer) && (
                                <span>·</span>
                              )}
                              {wine.subType && <span>{wine.subType}</span>}
                              {wine.subType && wine.producer && <span>·</span>}
                              {wine.producer && <span>{wine.producer}</span>}
                              {(wine.wine || wine.subType || wine.producer) &&
                                wine.region && <span>·</span>}
                              {wine.region && <span>{wine.region}</span>}
                              {(wine.wine ||
                                wine.subType ||
                                wine.producer ||
                                wine.region) &&
                                wine.country && <span>·</span>}
                              {wine.country && <span>{wine.country}</span>}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                      <CommandItem
                        onSelect={() => {
                          setOpen(false);
                          navigate("/add");
                        }}
                        className="border-t py-2 cursor-pointer"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Add a custom bottle instead</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
