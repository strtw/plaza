FE Tests:

- Sign up flows
   - If phone doesn't exist, user is prompted to sign up
   - If text veriication doesn't work, user has chance to re-send the code
   - User can navigate back from the verification panel to change their name if they want before they verifiy
- Activity panel
    - Fresh user adds friends and then sees their updates first time without having to manually refrehs, subsequent updates have to manually refresh
    - If a user has a status in the activity panel (meaning it's active), clicking into their profile should show that status. 
    - new status badge and updated should persist between route changes

- Status updates
     - user can click status button from activity screen, modal opens, and they have to enter location, message and expiration time to set status and close the modal, then their status shows at the top windw. 
     - when user sets the modal it should appear with the same styling as a normal contact row (feature no implemented yet)
     - set and clear status work
     - when user A clears a status that user B has rsvp'd for, message should show that user A has cleared it, and user B should be able to set a new status. 
     - User can't set their own status if they are attending someone elses
     - User rsvp for one status, can't rsvp to another
     - User has to cancel RSVP'd status to attend another. 
     - One user clicks the top bar where user A has cancelled an event that user B has rsvpd for there should be a message saying user A has cancelled, and then setting a new status and returning should reomve this message. 

- Filtering
    - If no status are available show default message, clicking links should open the set status or invite functionality
    - If filtered status are available, clicking the filter link should open the filter functonaity.

- Status edit when attendees exist (host has people “on my way”)
    - End time: only allow extending, not shortening. Backend rejects earlier endTime (and endTime in the past); frontend only allows picking a time ≥ current endTime and ≥ now. Picker clamps earlier selections to the minimum.
    - Location: read-only when attendees exist. Host cannot change location; UI shows current location with “Can’t change when people are attending”.
    - Start time and availability type: not editable when attendees exist. Backend ignores startTime/location/status in the update; frontend uses current status’s startTime and location in the save payload.
    - SharedWith (invitees): add-only. Host can only add new people who have been shared with; cannot remove existing invitees. Backend merges existing sharedWith with new; frontend merge on invite modal close so existing invitees stay selected.