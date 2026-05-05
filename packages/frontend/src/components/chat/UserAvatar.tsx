import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface IUserAvatarProps {
  type?: "sidebar" | "chat" | "profile";
  name?: string;
  avatarUrl?: string;
  className?: string;
  user?: {
    displayName?: string;
    avatarUrl?: string;
    username?: string;
  };
  size?: string;
}

const UserAvatar = ({ type = "chat", name, avatarUrl, className, user, size }: IUserAvatarProps) => {
  const displayName = user?.displayName || user?.username || name || "Pete";
  const imgUrl = user?.avatarUrl || avatarUrl;
  const bgColor = !imgUrl ? "bg-blue-500" : "";
  const avatarType = user ? "sidebar" : type;

  return (
    <Avatar
      className={cn(
        className ?? "",
        size ?? (avatarType === "sidebar" && "size-12 text-base"),
        avatarType === "chat" && "size-8 text-sm",
        avatarType === "profile" && "size-24 text-3xl shadow-md"
      )}
    >
      <AvatarImage
        src={imgUrl}
        alt={displayName}
      />
      <AvatarFallback className={`${bgColor} text-white font-semibold`}>
        {displayName.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
