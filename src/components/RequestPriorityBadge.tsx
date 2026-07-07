import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRequestPriorityInfo } from "@/lib/requestPriority";

interface RequestPriorityBadgeProps {
  requestTypeName?: string | null;
  className?: string;
}

export default function RequestPriorityBadge({ requestTypeName, className }: RequestPriorityBadgeProps) {
  const priority = getRequestPriorityInfo(requestTypeName);

  return (
    <Badge variant="outline" className={cn("capitalize", priority.badgeClassName, className)}>
      {priority.label}
    </Badge>
  );
}
