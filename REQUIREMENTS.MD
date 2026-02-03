## Accept / Block / Mute Flow
- When a user adds you to one of their circles, or manually selects you to share their updates, you are prompted to accept or block. If you accept you will see their updates, if you block you won't see them. They won't have any idea if you accept or block. There should be a little note that says something like "You can mute them or block them later if you change your mind"

## Friends/Circles Display UX
**Status**: TODO - Future enhancement

**Problem**: 
- Users can add friends (people they broadcast to)
- Users can receive broadcasts from people who added them
- Current UX only shows "your contacts" (people you added)
- Users might want to see who is broadcasting to them so they can reciprocate

**Considerations**:
- Avoid feeling exclusionary or fostering bad feelings
- Protect users' ability to reciprocate or not
- Consider "circles" concept to organize:
  - People you broadcast to (your friends)
  - People broadcasting to you (people who added you)
  - Mutual connections

**Related Files**:
- `mobile-app/app/(tabs)/contacts.tsx` - Contacts tab display
- `mobile-app/app/(tabs)/activity.tsx` - Activity tab (shows statuses from people who added you)


STATUS setting:
- 

- Consider a FOMO setting where if I set an event I can't see others events until my event is done

- FOMO might also be where if you are attending an event, you mark it as attended when you are on your way or there, and then to see more events you have to leave the event? this introduces complexity. 

- - Invitations - once you set a status and invite people you can't remove people. You can only add more within the rough group size e.g. if it's "large group" and you invite 8 people you can add up to 4 more to get to twelve. But no more. This is to preserve invitee  expectations.