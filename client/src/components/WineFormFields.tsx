import { UseFormReturn } from "react-hook-form";
import { InsertWine, WineCategory } from "@shared/schema";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to safely convert null values to empty string for form inputs
const nullToString = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return value;
};

interface WineFormFieldsProps {
  form: UseFormReturn<InsertWine>;
}

export default function WineFormFields({ form }: WineFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wine Name*</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Château Margaux" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category*</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={WineCategory.RED}>Red Wine</SelectItem>
                  <SelectItem value={WineCategory.WHITE}>White Wine</SelectItem>
                  <SelectItem value={WineCategory.ROSE}>Rosé Wine</SelectItem>
                  <SelectItem value={WineCategory.FORTIFIED}>Fortified Wine</SelectItem>
                  <SelectItem value={WineCategory.BEER}>Beer</SelectItem>
                  <SelectItem value={WineCategory.CIDER}>Cider</SelectItem>
                  <SelectItem value={WineCategory.WHISKIES}>Whiskies</SelectItem>
                  <SelectItem value={WineCategory.OTHER}>Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="wine"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wine Type</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Cabernet Sauvignon" value={nullToString(field.value)} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
              </FormControl>
              <FormDescription>
                The specific variety or type of wine
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="subType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-Type</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Grand Cru" value={nullToString(field.value)} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
              </FormControl>
              <FormDescription>
                Additional classification or sub-type
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="producer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producer/Winery</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Château Margaux" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="stockLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of Bottles</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={0}
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  value={field.value?.toString() || "0"}
                />
              </FormControl>
              <FormDescription>
                Total number of bottles in your collection
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Region</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Bordeaux" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input placeholder="e.g., France" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Your personal notes about this wine..." 
                className="resize-none" 
                rows={3}
                {...field}
                value={field.value ?? ''} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="rating"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Your Rating (1-5)</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                min={1}
                max={5}
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value) || null)}
                value={field.value?.toString() || ""}
                placeholder="Rate from 1 to 5"
              />
            </FormControl>
            <FormDescription>
              Rate this from 1 (poor) to 5 (excellent)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
