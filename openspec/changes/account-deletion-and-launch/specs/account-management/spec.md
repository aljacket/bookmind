## ADDED Requirements

### Requirement: In-app account deletion

A signed-in user SHALL be able to start permanent deletion of their account from the in-app menu, without leaving the app and without contacting support. Before confirming, the flow SHALL tell the user what is deleted, what is retained, and for how long. Deactivating or disabling the account SHALL NOT be offered as a substitute.

#### Scenario: Entry point is reachable from the menu

-   **WHEN** a signed-in user opens the menu on any authenticated screen
-   **THEN** a "Delete account" action is visible, separate from "Logout", and opens the deletion dialog

#### Scenario: Dialog explains deletion and retention

-   **WHEN** the deletion dialog opens
-   **THEN** it states, in the selected language (en/it/es), that the account, reading list and saved recommendations are deleted, and it states the retention periods listed in the privacy policy for data that is not deleted immediately

### Requirement: Deletion requires reauthentication

Deletion SHALL be confirmed with the account password through Firebase `reauthenticateWithCredential`. The dialog SHALL offer a link to the password-reset flow.

#### Scenario: Wrong password

-   **WHEN** the user confirms deletion with a wrong password
-   **THEN** the account is not deleted, local data is untouched, and a localized error is shown in the dialog

#### Scenario: Forgotten password

-   **WHEN** the user taps "Forgot password?" in the dialog
-   **THEN** the existing password-reset flow opens

### Requirement: Cloud-first deletion order

After reauthentication, the system SHALL delete the Firebase Auth user first. It SHALL wipe local data for that UID only after the cloud deletion succeeds, then sign out and redirect to `/login?deleted=1`, where a localized confirmation is shown.

#### Scenario: Successful deletion

-   **WHEN** the user confirms with the correct password and the network is available
-   **THEN** the Firebase Auth user no longer exists, every IndexedDB key with the prefix `${uid}_` is gone from all `BookMindDB` stores, the user is signed out, and `/login?deleted=1` shows the deletion confirmation

#### Scenario: Cloud deletion fails

-   **WHEN** `deleteUser` fails (for example, the device is offline)
-   **THEN** no local data is wiped, the user stays signed in, and a localized error is shown

#### Scenario: Old token is rejected after deletion

-   **WHEN** a request is sent to the recommendation API with an ID token issued before the deletion, after the deletion completed
-   **THEN** the API returns 401 and OpenAI is not called

### Requirement: Interrupted deletion heals at next launch

Before calling `deleteUser`, the system SHALL record a pending-deletion marker holding the UID. At startup, after Firebase Auth has initialised with no signed-in user, any data for the marked UID SHALL be wiped and the marker cleared. Local data of users who merely logged out SHALL NOT be wiped.

#### Scenario: App killed between cloud deletion and local wipe

-   **WHEN** the Firebase user was deleted but the app was killed before the local wipe, and the app is relaunched
-   **THEN** the data for that UID is wiped and the marker is cleared before the login screen is shown

#### Scenario: Normal logout keeps local data

-   **WHEN** a user logs out without deleting the account, and the app is relaunched
-   **THEN** that user's reading list is still present in IndexedDB and appears again after they sign in

### Requirement: Public web deletion page

A public page at `/delete-account` on the Firebase Hosting URL SHALL let a user delete their account without the app installed. It SHALL name the app as listed in the stores, require sign-in with email and password on the page itself, and reuse the in-app deletion flow. It SHALL NOT redirect anonymous visitors to `/login`.

#### Scenario: Anonymous visitor

-   **WHEN** `/delete-account` is opened in a private browser window
-   **THEN** the page renders its own sign-in form and the deletion explanation, and the URL stays `/delete-account`

#### Scenario: Deletion from the web

-   **WHEN** a visitor signs in on `/delete-account` and confirms with the password
-   **THEN** the Firebase Auth user is deleted and the page shows a confirmation, with the same order and errors as in the app
