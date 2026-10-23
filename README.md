# Stockroom

An offline inventory app for one store owner on one phone, using Expo SDK 58, React Native, TypeScript, Expo Router, React Context, and AsyncStorage.

## Product behavior

Home shows **one row per product and its total available quantity**. Add Inventory Item creates a new product with its initial receipt. Open an existing product and choose **Receive stock** for later deliveries; receiving adds to the available total and saves that delivery's quantity, date, optional unit cost, and notes in **Stock History**.

For example: receive 20 units at 15.00, sell 8, then receive 10 at 16.00. Home still shows one product, with **22 units available**. Its history keeps the first delivery's acquisition cost at **300.00** and the second at **160.00**. Further sales, damage, count corrections, and product edits do not rewrite those receipt costs. There is no standalone acquisition-cost card based on the current quantity.

New inventory items are unique by **name and location**, ignoring capitalization and surrounding spaces. The same name may be stored at different locations. A different measurement cannot bypass the duplicate check at the same location. Duplicate creation or name/location changes show a message naming the item and location and suggesting Receive stock on the existing record. Existing unit variants created under the old rule remain readable and can receive stock or unrelated metadata edits; they are not silently merged. Each receipt retains its original location.

- Create a product with name, initial quantity, saved location, alert threshold, received date, optional measurement, optional unit cost, and notes.
- Receive stock through a dedicated form with positive quantity, date, optional cost, and optional delivery notes. Initial stock may be zero; later deliveries must be positive.
- Edit product name, available quantity, location, measurement, threshold, and notes. Quantity changes require Sold, Damaged, Count correction, or Other; receiving uses its own action and automatically records Restocked.
- Sold/Damaged reduce stock; count corrections and Other may move either way. Corrections do not create purchase receipts.
- Stock History shows the latest three receipts/adjustments and View All for longer history. Each receipt shows its date, quantity, unit cost, and acquisition cost. Explanations expand on demand.
- Product details show total quantity, Stock History, a collapsed Movement Summary, metadata, notes, Receive stock, and one Edit stock details button. Receive stock sits directly above Edit stock details.
- Delete inventory item appears below Edit stock details. Its confirmation names the item and offers Cancel/Delete, explaining that delivery and movement history will also be permanently deleted. The item and history are removed in one save; reusable locations and unrelated items remain. Failed saves keep the item intact and display an error. Successful deletion returns to the inventory list.
- Expand Movement Summary to switch between the last 7 and 30 days. It shows signed units restocked, sold, damaged, corrected, and changed for other reasons, plus net movement. Periods include today and the previous 6/29 local calendar days, up to the summary's current time, and group movements by their saved timestamps rather than backdated receipt dates. The initial opening balance and imported receipt records are excluded; known imported adjustments still count by their recorded reasons. A visible note identifies incomplete imported history. An empty period shows a clear message.
- Low-stock badges and filters use the product's total quantity, including equality and zero. Search, low-stock filtering, and sorting combine.
- Sort by creation date, most-recently-received date, total quantity, or location. Newest creation comes first by default; receiving and editing do not change creation order.
- Locations are saved independently through an inline dropdown, with case-insensitive deduplication and selection.
- Forms use concise labels, red required asterisks, accessible required labels, inline errors, and a visible bottom summary. Explanatory field descriptions have been removed. Failed saves preserve inputs and previous shared state.
- Native modals use safe-area providers and keyboard avoidance. Shared tokens provide spacing, rounded corners, and subtle shadows.
- Fresh installations remain empty. No dummy-data generator is included. Existing saved samples remain intact as existing user data.

No login, backend, synchronization, checkout, accounting ledger, barcode scanning, OS notifications, or analytics dashboard is included.

## Data and migration

Products have immutable IDs and creation timestamps, a current total quantity, current metadata, an automatically updated timestamp, and the most recent received calendar date. Dates use local `YYYY-MM-DD`; timestamps use canonical UTC ISO values displayed in local time. Backdated receipts retain their dates without moving the product's latest received date backwards. Movement summaries are derived from history without changing or persisting it. Their internal integer sums avoid precision loss; totals outside the safe numeric display range show Too large to display, while an exactly representable net remains available. Expanded summaries refresh after saved history changes and every minute; opening the section or changing its period also refreshes the time window.

Each delivery has a fixed received quantity and movement, with optional unit cost and total acquisition cost. Add and Receive stock suggest quantity × unit cost; enter a total to override that suggestion, including fees or an invoice amount when unit cost is unknown. Blank total uses the suggestion, while both costs blank remain unavailable. Save the final total in integer minor units; explicit zero remains zero. Amounts accept at most two decimal places and must fit safe integers. Use one currency throughout.

Choose **Edit delivery costs** in Stock History (including View All) to correct unit cost, total acquisition cost, or delivery notes. **Use calculated total** clears the override. Edits preserve received quantities, dates, location, movement balances, timestamps, and append order; they update the product's last-updated time and show a separate Costs updated timestamp. Failed saves retain entered values and prior saved data. The v5 receipt format adds optional `totalAcquisitionCostMinor` and `costUpdatedAt` fields; older receipts without a saved total retain their calculated display until edited, with no startup write.

Snapshot version **5** uses the original `@stockroom/inventory/v1` key. Startup validates and migrates in memory without writing; the next successful mutation persists v5. Existing v1–v4 records with matching names, locations, and measurements merge into one product, summing remaining quantities. Different locations and incompatible measurements remain separate. Migration preserves the first product ID, earliest creation time, latest product metadata, latest received date, and maximum alert threshold. Original record notes remain in imported receipts, including notes not selected as current product metadata. Original saved locations remain available.

Known v4 receipt quantities and prices become imported receipt history. Original received quantities unavailable in v1–v3, or unconfirmed in v4, stay unknown; acquisition cost stays unavailable. The app never guesses an original purchase quantity. Original movement IDs, counts, reasons, explanations, timestamps, and relative save order survive migration. Original record IDs become source references. Imported adjustments display **Original delivery balance**, because those before/after counts describe an older delivery record rather than a product-wide historical total. Imported receipts precede the preserved adjustment sequence; no missing events or historical aggregate balances are fabricated.

Imported receipts retain frozen remaining-at-import balances to validate source histories and the opening combined product balance. New product history must be consecutive and end at the current available quantity. Every mutation saves the stock and history together, and the provider publishes new state only after storage succeeds. No-op and metadata-only edits add no movements. History displays in reverse save order, including timestamp ties or clock changes. Legacy `demoSeeded` metadata remains readable but never generates records.

Invalid records, money, references, dates, source/history chains, duplicate IDs/products, unsupported versions, or unreadable JSON produce a retryable error without silently replacing data. Storage operations use an injected driver for framework-independent tests; only the native adapter imports AsyncStorage.

## Structure

Expo Router entry files live in `src/app` and only export the corresponding screen or navigator. Screen implementations have descriptive filenames under `src/features/inventory/screens`; stack/provider setup lives in `src/navigation/AppNavigator.tsx`.

```text
src/
  app/
    _layout.tsx                 Entry for AppNavigator and initial-route settings
    index.tsx                   Entry for InventoryListScreen (/)
    inventory/
      add-item.tsx              Entry for AddInventoryItemScreen (/inventory/add-item)
      [itemId].tsx              Entry for InventoryItemDetailsScreen (/inventory/:itemId)
  navigation/
    AppNavigator.tsx            Root stack, provider, status bar, save/back protection
  features/inventory/
    screens/
      InventoryListScreen.tsx   Inventory list, search, filtering, sorting
      AddInventoryItemScreen.tsx Creation screen and return-home behavior
      InventoryItemDetailsScreen.tsx Details, receiving, editing, deletion, history
    components/                 Inventory-specific UI
  components/                   Reusable controls
  theme/inventoryTheme.ts       Colors, spacing, radii, shadows, content width
```

`index.tsx`, `_layout.tsx`, and bracketed parameters follow Expo Router's filename conventions; application implementation stays in descriptively named modules. The previous `/stocks/new` and `/stocks/[id]` routes have been replaced, and all in-app navigation uses the new inventory routes.

Inventory models, pure actions/selectors, form validation, snapshot validation/migration, provider, and storage adapters also live in `src/features/inventory`. `StockForm` handles product creation/editing, `ReceiveStockForm` handles delivery inputs, and the edit modal supplies navigation/layout for either form. `QuantityAdjustment` renders controlled quantity/reason inputs. Movement aggregation lives in the pure `inventory.movements.ts` module; `StockMovementSummary` owns only expansion, period selection, and refresh state. Existing tests live in `tests/`; no tests were changed for the screen reorganization.

## Verification

No new dependencies are required. Use Node.js 22.13 or later, pnpm, and Expo Go compatible with SDK 58. From `ims-mobile-app/` (the directory containing `package.json`), run:

```sh
pnpm run typecheck
pnpm test
pnpm run lint
pnpm start
```

Typecheck validates TypeScript without emitting application files. Tests compile framework-independent modules into ignored `.test-build/` and use Node's built-in test runner. Lint may create local caches. Start launches Metro and may generate ignored `.expo/` and `expo-env.d.ts` files; scan the QR code in Expo Go. Agents cannot execute these commands under AGENTS.md. No agent has claimed these checks pass.

After changing route filenames, start or restart Expo using `pnpm start` so it refreshes generated route types in `.expo/types/router.d.ts` before running typecheck. Do not edit that generated file manually. The screen reorganization has been inspected through read-only source checks; runtime navigation and typecheck/lint remain pending the user's execution.

The product/history update has authored regression tests covering atomic initial receipts, receiving totals, stable delivery costs after sales/damage/corrections, duplicate products, unit distinctions, no-op/metadata changes, history ordering, optional values, money/quantity overflow, input feedback, low-stock boundaries, combined selectors, migration v1–v4, malformed data, startup without samples/writes, persistence, and failed writes. Tests, typecheck, lint, provider/component execution, and device checks remain pending the user's execution. Earlier subagent reviews concerned the previous design; this change has not received an additional subagent review.

Movement-summary regression tests additionally cover per-product signed unit totals, opening/imported receipt exclusions, known legacy movements, local midnight boundaries, 7/30-day differences, future-save exclusion, backdated receipts, empty periods, leap/year boundaries, and exact cancellation when category totals overflow the safe display range. These tests have been authored but not executed by the agent.

The later delete-item update was inspected through read-only source checks. No tests were added or modified for deletion, following the user's rule that test work requires an explicit request. Runtime verification remains pending the user's execution.

## Device checks

1. Add Rice (1 kg), quantity 20, cost 15.00, threshold 5. Confirm one Home row with 20 available and an initial receipt with acquisition cost 300.00.
2. Receive 10 at 16.00 on a different date. Confirm one row with 30 available, unchanged creation order, and two independent receipt costs of 300.00 and 160.00.
3. Sell 8 with a reason. Confirm 22 available, one adjustment, and unchanged receipt costs. Sell down to zero; both purchase costs remain in history. Count corrections may increase quantity without inventing a delivery.
4. Attempt to add or rename another product to ` rice ` with measurement `1 KG`. Confirm duplicate feedback. Add Rice with 500 g and confirm it remains distinct.
5. Open v4 test data with two same-product delivery records, including quantity history. Confirm one product with the sum of remaining quantities, both receipt costs/dates/locations/notes, and original delivery balance labels on imported movements. Receive more and restart to confirm v5 persists without another merge or extra receipts.
6. Open v1–v3 data or unconfirmed v4 data. Confirm stock is preserved, receipts stay unknown where necessary, and no historical acquisition amounts are guessed.
7. Verify invalid/blank required values, zero/negative/fractional delivery quantities, invalid dates/costs, and missing adjustment reasons. Feedback must appear inline and at the bottom, including when upper fields are off-screen. Required asterisks/accessibility labels remain; field descriptions are absent.
8. Cancel receiving/editing and verify nothing changes. In a controlled storage-failure setup, confirm prior stock/history remain, inputs stay populated, and retry adds exactly one receipt or adjustment.
9. Receive a backdated delivery. Confirm its date in history and unchanged most-recently-received date when an existing receipt is newer. Check local date display after restart.
10. Verify low-stock equality/zero, counts, search, all sort directions, and their combination. After adding a product, Home should reset filters/sort/scroll to show it first.
11. Verify latest-three and View All history, optional explanations, notched-device modal headers, small screens, large text, screen readers, and Save/Cancel access with the keyboard open. Repeated save taps must not duplicate receipts.
12. Reopen a fresh installation repeatedly: no samples should appear. Existing installations retain saved records and locations. Add a location without saving a product; it must survive restart and case-insensitive duplicates must reuse it.
13. Confirm Receive stock appears directly above Edit stock details, with one of each. Movement Summary should appear below Stock History and start collapsed. Expand/collapse it and switch between 7 and 30 days; check touch targets, small-screen wrapping, and screen-reader expanded/selected states.
14. With an opening balance excluded, record +20 restocked, −8 sold, −2 damaged, +1 correction, and −1 Other within the selected period. Confirm all five rows show those signed unit amounts and net movement is +10. Initial-stock-only and empty periods should show no recorded movements. Known imported adjustments should count once; imported receipts should not be counted as fresh restocks.
15. Leave the summary expanded, save a delivery or adjustment, and confirm it refreshes. Restart, reopen the summary, and check the same totals. For a backdated receipt saved today, confirm it counts by today's recorded timestamp. Test entries on the first local midnight of the period, outside the period, and beyond the current clock time in a controlled test setup.
