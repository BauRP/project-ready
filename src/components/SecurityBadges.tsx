import { Lock, EyeOff } from "lucide-react";

interface SecurityBadgesProps {
  e2ee?: boolean;
  invisible?: boolean;
  size?: number;
}

const SecurityBadges = ({ e2ee = true, invisible = false, size = 12 }: SecurityBadgesProps) => {
  return (
    <div className="flex items-center gap-0.5">
      <Lock
        size={size}
        className={e2ee ? "text-primary" : "text-muted-foreground/40"}
        style={e2ee ? { filter: "drop-shadow(0 0 3px hsl(var(--neon-glow) / 0.5))" } : {}}
      />
      <EyeOff
        size={size}
        className={invisible ? "text-primary" : "text-muted-foreground/40"}
        style={invisible ? { filter: "drop-shadow(0 0 3px hsl(var(--neon-glow) / 0.5))" } : {}}
      />
    </div>
  );
};

export default SecurityBadges;
