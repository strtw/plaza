import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '../../../stores/userStore';
import { FindFriendsModal } from '../../../components/FindFriendsModal';

export default function AddFriendsScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const setLastAddFriendsCount = useUserStore((s) => s.setLastAddFriendsCount);

  const handleClose = (count?: number) => {
    if (count !== undefined) setLastAddFriendsCount(count);
    router.back();
  };

  return (
    <FindFriendsModal
      visible
      onClose={handleClose}
      asFullScreen
      addToGroupMode={from === 'groups'}
    />
  );
}
