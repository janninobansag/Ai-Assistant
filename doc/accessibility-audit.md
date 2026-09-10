# Mobile accessibility and responsive audit

Completed source-level audit: 2026-09-10.

## Implemented checks

- [x] App has a 320px minimum layout width and a constrained mobile content column.
- [x] Interactive controls have visible keyboard focus.
- [x] Settings and Privacy panels have dialog semantics, receive focus, close with Escape, and can be dismissed by tapping outside.
- [x] A skip link lets keyboard users reach main content.
- [x] Subject, material, authentication, and tutor fields have programmatic labels.
- [x] Status/error messages use status or alert semantics where shown.
- [x] Settings icon and close controls have accessible names and at least 44px targets.
- [x] Information is not conveyed by colour alone in quiz review states.

## Required manual release checks

- [ ] Test all core flows at 320px and at 200% zoom in Chrome and Safari.
- [ ] Test with Android TalkBack and iPhone VoiceOver.
- [ ] Check keyboard tab order and focus return after closing each panel.
- [ ] Run an automated browser accessibility scan against the deployed HTTPS app.
- [ ] Confirm tap targets remain comfortable on a physical phone.
