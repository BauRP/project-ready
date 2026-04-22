import { User } from "lucide-react";

interface DefaultAvatarProps {
  src?: string | null;
  size?: number;
  className?: string;
}

const DefaultAvatar = ({ src, size = 48, className = "" }: DefaultAvatarProps) => {
  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        className={`rounded-full object-cover neon-border ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-secondary/60 flex items-center justify-center neon-border ${className}`}
      style={{ width: size, height: size }}
    >
      <User size={size * 0.5} className="text-muted-foreground/60" />
    </div>
  );
};

export default DefaultAvatar;
