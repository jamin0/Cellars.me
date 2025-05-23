
import ThemeToggle from "@/components/ui/theme-toggle";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "Cellars.me" }: HeaderProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={document.documentElement.classList.contains('dark') ? '/cellarsd.jpg' : '/cellars.jpg'}
            alt="Cellars.me"
            className="h-6 w-6 object-contain"
          />
          <span className="font-medium">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-muted-foreground">
              {user.name}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Logout</span>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
