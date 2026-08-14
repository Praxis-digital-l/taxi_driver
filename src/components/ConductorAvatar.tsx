import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type ConductorAvatarProps = {
  fullName?: string | null;
  photoUrl?: string | null;
  className?: string;
};

export function ConductorAvatar({ fullName, photoUrl, className }: ConductorAvatarProps) {
  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={fullName ?? "Conductor"} /> : null}
      <AvatarFallback className="bg-muted text-muted-foreground">
        <User strokeWidth={2.5} className="h-1/2 w-1/2" />
      </AvatarFallback>
    </Avatar>
  );
}