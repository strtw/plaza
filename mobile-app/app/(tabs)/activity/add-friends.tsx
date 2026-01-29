import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUserStore } from '../../../stores/userStore';
import { FindFriendsModal } from '../../../components/FindFriendsModal';

export default function AddFriendsScreen() {
  const router = useRouter();
  const { from, groupId } = useLocalSearchParams<{ from?: string; groupId?: string }>();
  const setLastAddFriendsCount = useUserStore((s) => s.setLastAddFriendsCount);

  const handleClose = (count?: number) => {
    if (count !== undefined) setLastAddFriendsCount(count);
    router.back();
  };

  const addToGroupMode = from === 'groups' || !!groupId;
  const existingGroupId = groupId ?? undefined;

  return (
    <FindFriendsModal
      visible
      onClose={handleClose}
      asFullScreen
      addToGroupMode={addToGroupMode}
      existingGroupId={existingGroupId}
    />
  );
}
