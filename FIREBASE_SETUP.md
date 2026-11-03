# Firebase setup for My Ideas Tracker

Project: `ideastracker-aea9d` (Spark, free). Firestore in asia-south1.

- Sign-in: Google only, locked to the shared account in `firestore.rules`.
- Data: one document, `boards/main`, holding the whole board. `cloud.js` saves it on every change and listens for changes from the other phone.
- Authorized domains must include `pulugurthashanthi.github.io`.
- To change rules: paste `firestore.rules` into Firestore → Rules → Publish.
