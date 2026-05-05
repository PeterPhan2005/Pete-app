import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { UserPlus } from "lucide-react";
import type { User } from "@/types/user";
import { useFriendStore } from "@/stores/useFriendStore";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import SearchForm from "@/components/AddFriendModal/SearchForm";
import SendFriendRequestForm from "@/components/AddFriendModal/SendFriendRequestForm";

export interface IFormValues {
  username: string;
  message: string;
}

const AddFriendModal = () => {
  const [isFound, setIsFound] = useState<boolean | null>(null);
  const [searchUser, setSearchUser] = useState<User>();
  const [searchedUsername, setSearchedUsername] = useState("");
  const [isFriend, setIsFriend] = useState(false);
  const { loading, searchByUsername, addFriend, friends, sentList, receivedList } = useFriendStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<IFormValues>({
    defaultValues: { username: "", message: "" },
  });

  const usernameValue = watch("username");

  const handleSearch = handleSubmit(async (data) => {
    const username = data.username.trim();
    if (!username) return;

    setIsFound(null);
    setSearchedUsername(username);
    setIsFriend(false);

    try {
      // Refresh friends list first
      await useFriendStore.getState().getFriends();
      await useFriendStore.getState().getAllFriendRequests();
      
      const foundUsers = await searchByUsername(username);
      if (foundUsers && foundUsers.length > 0) {
        setIsFound(true);
        const user = foundUsers[0];
        setSearchUser(user);
        
        // Check if already friend or has pending request
        const currentFriends = useFriendStore.getState().friends;
        const currentSentList = useFriendStore.getState().sentList;
        const currentReceivedList = useFriendStore.getState().receivedList;
        
        const isAlreadyFriend = currentFriends.some(f => f.friendId?._id === user._id || f._id === user._id);
        const hasSentRequest = currentSentList.some(r => r.to?._id === user._id);
        const hasReceivedRequest = currentReceivedList.some(r => r.from?._id === user._id);
        
        setIsFriend(isAlreadyFriend || hasSentRequest || hasReceivedRequest);
      } else {
        setIsFound(false);
      }
    } catch (error) {
      console.error(error);
      setIsFound(false);
    }
  });

  const handleSend = handleSubmit(async (data) => {
    if (!searchUser) return;

    try {
      const message = await addFriend(searchUser._id, data.message.trim());
      toast.success(message);
      
      // Set isFriend to true to disable button
      setIsFriend(true);
      
      // Don't close modal immediately, let user see the success state
      setTimeout(() => {
        handleCancel();
      }, 1000);
    } catch (error) {
      console.error("Lỗi xảy ra khi gửi request từ form", error);
    }
  });

  const handleCancel = () => {
    reset();
    setSearchedUsername("");
    setIsFound(null);
    setIsFriend(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex justify-center items-center size-5 rounded-full hover:bg-sidebar-accent cursor-pointer z-10">
          <UserPlus className="size-4" />
          <span className="sr-only">Kết bạn</span>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-none">
        <DialogHeader>
          <DialogTitle>Kết Bạn</DialogTitle>
        </DialogHeader>

        {!isFound && (
          <>
            <SearchForm
              register={register}
              errors={errors}
              usernameValue={usernameValue}
              loading={loading}
              isFound={isFound}
              searchedUsername={searchedUsername}
              onSubmit={handleSearch}
              onCancel={handleCancel}
            />
          </>
        )}

        {isFound && (
          <>
            <SendFriendRequestForm
              register={register}
              loading={loading}
              searchedUser={searchUser}
              isFriend={isFriend}
              onSubmit={handleSend}
              onBack={() => setIsFound(null)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
