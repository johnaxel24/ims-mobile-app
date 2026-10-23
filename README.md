# Stockroom

A small, offline inventory application for one store owner on one phone. Built with Expo SDK 58, React Native, TypeScript, Expo Router, React Context, and AsyncStorage.

## Setup

Use Node.js 22.13 or later, pnpm (the starter already uses a pnpm lockfile), and an Expo Go version compatible with SDK 58. Run all commands below from `ims-mobile-app/`, the directory containing `package.json`.

The agent did not install dependencies or execute the app, tests, lint, or typecheck. These commands must be run by the user under the workspace's `AGENTS.md` restrictions.

```sh
pnpm exec expo install @react-native-async-storage/async-storage
pnpm exec expo install 'eslint@^9' eslint-config-expo --dev
```

The first command adds the SDK-compatible persistent storage dependency. The second adds the lint tools required by `eslint.config.js`. Both update `package.json`, `pnpm-lock.yaml`, and `node_modules`; do not replace the existing lockfile with another package manager's lockfile.

Then verify and start:

```sh
pnpm run typecheck
pnpm run lint
pnpm test
pnpm start
```

`typecheck` checks application TypeScript without emitting application files. `lint` checks source and configuration; Expo/ESLint may create local cache files. `test` compiles the framework-independent logic into the ignored `.test-build/` directory and runs Node's built-in test runner, without additional test-framework dependencies. `start` runs Metro and may generate ignored `.expo/` and `expo-env.d.ts` files; scan its QR code using Expo Go on a device on the same network.

If dependency compatibility needs diagnosis, run `npx expo-doctor` from this same directory. For Expo Go SDK compatibility, see the [Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/).

## Features

- Add stock with a name, quantity, saved location, low-stock threshold, date received, and optional cost per unit, measurement per unit, and notes.
- Select a location from a dropdown or add one inline. Location names are saved independently, reused, and deduplicated without regard to capitalization.
- See a live, read-only total acquisition cost when cost is provided: current quantity × cost per unit. Missing cost remains unknown rather than becoming zero.
- Keep the acquisition-cost preview visible when cost is cleared in add or edit forms, showing Not Provided. Invalid supplied values show a correction hint rather than a misleading calculated amount.
- View all details, including the immutable `created_at` timestamp and automatically maintained last-updated timestamp.
- Edit name, quantity, saved location, optional cost/measurement, alert threshold, most recently received date, and notes through Edit Stock Details. Creation timestamp and ID stay fixed; last updated is automatic, and acquisition cost remains calculated.
- Stock details sections appear in this order: quantity, history, stock details, notes, total acquisition cost, then one Edit Stock Details button. The received date is labeled Most recently received date.
- Preview each quantity change before saving, choose a required reason (Restocked, Sold, Damaged, Count correction, or Other), and optionally attach an explanation separate from stock notes.
- View the latest three quantity changes on stock details, expand explanations, and open the full history when there are more than three entries. History shows the signed change, before/after quantity, reason, and local timestamp.
- See Low Stock indicators at or below the alert threshold and filter to those records.
- Search names with case-insensitive partial matches; combine search with filtering and sorting.
- Sort by date added, inventory date, quantity, or location in either direction; default to most recently created.
- See compact inventory rows immediately below search and All/Low Stock filters. Search and filters remain accessible while the list scrolls; sorting options open in a sheet. Costs and received dates remain on stock details.
- Cards have consistent gaps, rounded corners, and subtle shared shadows. Native modals have local safe-area providers to keep headers below the status bar.
- Return home after adding stock, clearing search/filters and restoring newest-first ordering so the saved item is visible.
- Keep records offline after restarting, with loading, empty, missing-record, validation, and retryable storage error states.
- Required fields have red asterisks and required-status accessibility labels. Failed add/edit submissions show a summary beside the save button naming all fields needing attention, including a missing quantity-change reason, and bring that feedback into view. Inline validation remains available.

On the first opening after the seed update, the app adds eight sample stock records across five locations, identified in their notes. These include healthy, low, and zero stock and an example with optional cost/measurement omitted. Existing records are preserved, and sample location names reuse existing case-insensitive matches. There is no login, server, deletion, checkout, accounting ledger, or system notification permission.

## Structure

```text
src/
  app/                         Expo Router list, add, and details screens
  components/                  Shared buttons, fields, feedback, and empty states
  features/inventory/
    components/                Stock cards, form, controlled quantity adjustment, edit modal, loading gate
    InventoryProvider.tsx      Shared state and serialized save operations
    inventory.types.ts         Explicit data and form interfaces
    inventory.logic.ts         Validation, money, dates, editing, and list selectors
    inventory.form.ts          Submission validation with complete field/reason feedback
    inventory.snapshot.ts      Untrusted JSON validation and v1/v2/v3 migration
    inventory.persistence.ts   Testable storage adapter with injected driver
    inventory.storage.ts       AsyncStorage integration
  theme/tokens.ts              Shared colors, spacing, and radii
tests/                         Node tests for inventory logic and persistence
```

## Data behavior

Each stock has a generated immutable ID and creation timestamp (`created_at`). Quantity and threshold use nonnegative whole units, including zero. Optional cost is stored as integer minor units (15.50 becomes 1550) or `null` when omitted; explicit zero remains a valid known cost. Optional measurement is trimmed descriptive text such as "500 g" or "1 L", stored as `measurementPerUnit` or `null`; it does not change the quantity or cost calculation. Use one currency consistently. Calculated totals must remain safe integers and are never stored separately; they are `null` when cost is unknown.

Inventory date is the most recently received date, a local calendar date entered as `YYYY-MM-DD`, defaulting to today. It is editable after creation and is not changed automatically when quantity changes. Last updated is an automatically generated UTC timestamp displayed in local time. Saving an unchanged edit leaves the timestamp alone.

After creation, creation time and ID are protected by the edit whitelist even if an untyped caller submits replacements. Name, saved location, quantity, threshold, notes, cost, measurement, and received date can be corrected; blank optional cost/measurement clear them to `null`. Editing location requires a saved name and uses its canonical casing. Metadata-only changes, including received-date edits, update last updated without creating quantity history. The persisted v3 record shape is unchanged, and no new dependencies are required.

The snapshot is stored at the original key `@stockroom/inventory/v1`, now as `{ version: 3, stocks: [...], locations: [...], quantityHistory: [...] }`, retaining the optional one-time `demoSeeded` flag. Existing v1/v2 snapshots migrate in memory without a write, starting with empty quantity history. For v1, locations are extracted from records, measurement defaults to `null`, and `created_at` falls back to `lastUpdatedAt`. The next successful mutation persists v3 at the same key. Previously seeded data does not seed again during migration.

Quantity updates append an immutable entry containing ID, stock ID, previous/new quantities, reason, optional explanation (empty string when absent), and UTC timestamp. The quantity and entry save together in one snapshot write; state updates only after that write succeeds. Notes-only edits, no-op saves, and canceled or failed saves create no history. Validation rejects orphaned/duplicate entries, invalid counts/reasons/timestamps, broken quantity chains, or a final history quantity that disagrees with the record. Entries display in reverse save order, including timestamp ties or device clock changes. No historical movements are inferred from existing inventory or demo data.

Loading validates the version, every record, and ID uniqueness. Invalid or unreadable data blocks edits and exposes a retry instead of silently replacing inventory with an empty array. Stock and location saves share a lock, and shared UI state changes only after persistence succeeds; failed saves retain form entries for another attempt. Stock creation requires a saved location; adding a duplicate name selects the existing canonical location. `created_at` never changes on edits. Equal creation timestamps use insertion order, with later-added records first.

The dropdown compares location names case-insensitively, including migrated records whose stored casing differs from the deduplicated saved name. Snapshot parsing lives in `inventory.snapshot.ts`, with the same storage key, v3 shape, and migration behavior. `buildEditedRecord` constructs records only; provider edits use `editStockInSnapshot` to enforce reason/history rules. The form owns submitted input and save coordination; `QuantityAdjustment` renders controlled values and owns only its reason-picker expansion. Submission validation in `inventory.form.ts` is framework-independent and covered by authored regression tests; execution is pending the user's checks.

App initialization adds the demo records only when `demoSeeded` is absent or false. The records and `demoSeeded: true` are persisted together in the same snapshot before inventory becomes available. Concurrent initialization calls share one operation; failures preserve the prior snapshot and allow retry. Future openings do not write or regenerate samples, and edits to samples remain intact. Stable sample IDs also prevent duplicates if an old snapshot contains those records without the flag. Clearing the app's stored data resets the flag and permits the one-time seed again. Raw storage reads remain read-only; only the app's explicit initialization path seeds data.

## Device acceptance checks

1. Open Add Stock, expand Location, and add "Shelf B". Add "Jasmine rice" with quantity 20, optional measurement "1 kg", cost per unit 15.00, threshold 5, and an earlier received date. Confirm it returns home with the new record first; open details and confirm the total is 300.00 and the record is in stock.
2. Open details and select Edit Stock Details. Enter 5, verify the preview shows 20 → 5 and −15, and try saving without a reason. Choose Sold, add an optional explanation and a stock note, and save. Confirm the total is 75.00, the Low Stock badge appears, and the history shows one entry with an expandable explanation.
3. Edit quantity to 0, then 12, selecting a reason each time. Confirm totals of 0.00 and 180.00; zero remains low stock, and 12 clears the badge. Make a fourth change and verify details shows only the latest three entries with View All opening the full list newest first. Save only notes, save an unchanged form, and cancel an edit; none should add a history entry.
4. Create records with different received dates, locations, and quantities, including blank cost and measurement. Verify newest-first creation ordering regardless of received dates, missing cost shown as unknown, explicit zero shown as 0.00, and all other sorts in both directions. Combine searching and the Low Stock filter, then add another record and verify the home list resets to show it first.
5. Check red asterisks on name, location, quantity, alert threshold, received date, new-location name, and the conditional quantity-change reason; optional fields and search must have no required marker. Try blank required fields, negative/fractional counts, an invalid optional cost, and an impossible date. Save from the bottom with the upper fields off-screen and confirm the bottom summary names every invalid field and is brought into view. Change quantity without selecting a reason (also try another invalid field at the same time) and confirm the bottom summary includes the missing reason. Verify inline errors, preserved inputs, and required labels in VoiceOver/TalkBack.
6. Close and reopen the app. Confirm all records, notes, costs, dates, and quantity history remain. With existing v1/v2 data, confirm records and the sample flag survive migration and history starts empty.
7. Check a smaller phone, a large text setting, VoiceOver/TalkBack, and keyboard visibility for the add screen and edit modal. Confirm stock rows are visible immediately, search/filters remain accessible while scrolling, the sort sheet scrolls and closes correctly, and repeated taps cannot create overlapping saves.
8. Where storage failures can be simulated, confirm loading offers retry without writing data and a failed save leaves the form, previous stock, and history intact. Retrying should create exactly one entry. Storage failure and invalid-snapshot cases are also covered by the authored automated tests.
9. Reuse a saved location and try adding its name with different capitalization. Confirm no duplicate location appears. Add a standalone location, leave without saving a stock, and restart to confirm the location remains available.
10. On first opening after the seed update, confirm eight sample records are added alongside any existing records. Edit a sample's quantity and notes, close and reopen the app twice, and confirm the count stays unchanged and the edit remains.
11. Open Edit Stock Details on a notched iPhone and an Android device. Confirm the header stays below the time/status bar, including after rotation, and the keyboard does not hide save/cancel controls. Check the full-history modal and sort sheet as well.
12. Edit name, location (including an inline new location), measurement, cost, threshold, received date, and notes without changing quantity. Confirm the changes persist after reopening, creation time stays unchanged, last updated advances, totals/alerts recalculate, and history count stays unchanged. Try an invalid received date and confirm saving is blocked. Clear optional cost/measurement and confirm they remain unknown. Repeat with a quantity change and confirm exactly one history entry. Check the requested section order, single bottom edit button, spacing, and shadows.
13. In an edit form with a supplied cost, clear it and confirm the acquisition-cost preview stays visible as Not Provided. Enter an invalid cost and confirm it shows a correction hint; enter zero and confirm a known 0.00 total. With mixed-case legacy location names, confirm the saved option is selected. After the refactor, recheck combined validation errors (including missing reason), inline location creation, failed-save retries, keyboard/feedback scrolling, and post-create navigation/filter reset.

## Verification status

The initial implementation received a read-only subagent review. Subsequent changes, including the compact inventory UI, quantity history, and v3 migration, have been inspected through read-only source checks and have authored regression tests. Execution-based verification is pending the user's commands and device checks; source inspection does not establish that lint, typecheck, tests, or a device build pass.

The expanded-editing and modal-layout update received a read-only senior React Native/architecture review. See [CODE_REVIEW.md](CODE_REVIEW.md) for its assessment, addressed findings, and future improvements. Additional tests cover editable-field validation, creation-time/ID protection, optional-value clearing, saved-location rules, recalculation, and combined detail/quantity saves. Received-date regression tests cover date-only changes, invalid dates, persistence, and sorting without changing creation order; they have not been executed by the agent.

The review follow-up fixes legacy location selection and the missing edit-cost preview, improves JSX readability, extracts quantity adjustment and snapshot parsing, and clarifies the record-builder API. Authored regression tests now cover mixed-case legacy selection and combined field/reason submission feedback. Existing migration, failed-save, quantity-history, and received-date tests now exercise the extracted modules. These are pure logic/storage tests, not component execution tests; actual provider, navigation, keyboard, and accessibility verification remains pending the user's commands and device checks.
