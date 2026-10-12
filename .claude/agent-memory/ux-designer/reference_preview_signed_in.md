---
name: reference-preview-signed-in
description: How to view authenticated BookMind screens (menu, home) in Chrome DevTools without a real account
metadata:
    type: reference
---

The agent must not create accounts on production Firebase. To look at authenticated screens on the local Vite dev server, run this in DevTools `evaluate_script` once `/login` has loaded:

`const app=document.querySelector('#app').__vue_app__; app.config.globalProperties.$pinia._s.get('auth').setUser({uid:'ux-preview',email:'preview@example.test'}); await app.config.globalProperties.$router.push('/')`

The fake user is lost on a reload or on a viewport `emulate` call, because `onAuthStateChanged` resets it. Repeat the snippet after every resize. This is for viewing layouts only: any flow that calls Firebase needs the operator's test account or the #54 emulators.

To see recommendation cards on Home without the backend (#67, 2026-10-12): walk `document.querySelector('#app').__vue_app__._instance.subTree` to the component whose `type.__file` contains `HomePage`, then assign `home.setupState.recommendations = [{title, author, reason, pageCount, publishedDate}]`. Pushing `/?newRecommendations=...` right after a Vite dependency reload left the router-view blank, so prefer the setupState route.
