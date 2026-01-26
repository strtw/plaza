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

- Filtering
    - If no status are available show default message, clicking links should open the set status or invite functionality
    - If filtered status are available, clicking the filter link should open the filter functonaity. 