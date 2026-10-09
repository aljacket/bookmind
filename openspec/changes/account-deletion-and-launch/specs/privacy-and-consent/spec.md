## ADDED Requirements

### Requirement: Public privacy policy URL

`https://<hosting-domain>/privacy` SHALL resolve, without sign-in and without geographic restriction, to the full privacy policy as an HTML page (not a PDF). The policy SHALL name BookMind and its developer, list the data in the change's data inventory and its recipients, and state retention and deletion.

#### Scenario: Private window

-   **WHEN** `/privacy` is opened in a private browser window
-   **THEN** the full privacy policy is displayed, titled as a privacy policy

### Requirement: Privacy policy link inside the app

The app SHALL show a "Privacy policy" link on the Login and Register screens and in the menu. The link SHALL open the Italian policy when the UI language is `it` and the English policy otherwise. On Android and iOS, the link SHALL open the policy and the user SHALL be able to return to the app in the same state.

#### Scenario: Link from Login on Android

-   **WHEN** the user taps "Privacy policy" on the Login screen on the Android emulator
-   **THEN** the policy opens and system back returns to the Login screen

### Requirement: Explicit consent before sending data to the AI provider

Before the first chat message is sent, the app SHALL show a disclosure stating what is sent (the chat messages and the titles and authors of liked books), to whom (the LLM provider configured in production, by name and by the country where it processes the data; with a router, both the router and the pinned upstream provider), why, and the retention, with a link to the privacy policy. The named recipients SHALL be the same as the third-party AI recipients listed in the privacy policy. It SHALL require an affirmative "accept" action. No request to `/recommendations/clarify` or `/recommendations` SHALL be made while consent is not granted for the current user on this device. Navigating away SHALL NOT count as consent.

#### Scenario: First chat

-   **WHEN** a user with no stored consent opens `/preferences`
-   **THEN** the consent disclosure is shown, the send control is disabled, and no request is made until the user accepts

#### Scenario: Decline

-   **WHEN** the user declines
-   **THEN** the chat stays disabled with a localized explanation, and Home and the reading list keep working

#### Scenario: Consent remembered

-   **WHEN** a user who accepted earlier opens `/preferences` again on the same device
-   **THEN** the chat is available immediately and the transparency note is visible

### Requirement: Consent can be withdrawn

The menu SHALL offer an action to withdraw AI consent. After withdrawal, the next visit to the chat SHALL show the consent disclosure again. A stored consent with an older disclosure version than the current one SHALL be treated as not granted.

#### Scenario: Withdraw

-   **WHEN** the user withdraws consent from the menu and opens `/preferences`
-   **THEN** the consent disclosure is shown and no request is made until the user accepts again
