# Cloud Run Preview Deployments

Preview deployments let you test a PR against a live Cloud Run revision
before merging. Each preview gets its own Firestore database seeded from
production data at the time the preview is created.

## How to request a preview

### Option 1: use `/ship`

Run `/ship` when opening a PR — it asks whether you want a preview and
adds `[gcloud preview]` to the title automatically if you say yes.

### Option 2: edit the PR title manually

Add `[gcloud preview]` anywhere in your PR title:

```
fix: accept challenge hydrates room state [gcloud preview]
```

The GitHub Actions `preview.yml` workflow detects this and:

1. Builds and pushes a Docker image tagged `pr-{N}`
2. Creates a Firestore named database `pr-{N}` seeded from the prod export
3. Deploys a zero-traffic Cloud Run revision with tag `pr-{N}`
4. Posts a comment on the PR with the preview URL

**You can add `[gcloud preview]` at any time** — even after opening the PR.
Edit the title and the workflow re-triggers within seconds.

## Preview URL

The URL pattern is:

```
https://pr-{N}---sudoku-battle-{hash}-zf.a.run.app
```

It appears as a comment on the PR after the workflow completes (~3-5 minutes).

## Database

Each preview gets a named Firestore database: `pr-{N}`.

- **Seeded once** from a prod export taken when the preview is first created.
- Subsequent pushes to the same PR redeploy the code but preserve database state
  (so you don't lose test data between pushes).
- The database is permanently deleted when the PR is closed or merged.

## Teardown

When the PR is closed (merged or abandoned), the workflow automatically:
- Removes the Cloud Run revision tag
- Deletes the `pr-{N}` Firestore database
- Deletes the GCS export objects used for seeding
- Posts a teardown confirmation comment on the PR

## Regretting "no preview"

If you initially opened a PR without `[gcloud preview]` and change your mind,
just edit the PR title to add it. The workflow fires on title edits too.

## Cost

Preview revisions are zero-traffic (no production requests routed to them).
Cloud Run only charges for actual request compute. Firestore named databases
charge for storage and reads/writes during your testing session.
Costs are negligible for typical PR lifetimes (hours to days).

## Architecture: Why PRs Can Authenticate to GCP

The production deploy workflow uses Workload Identity Federation with a rule
that only allows git tag pushes to authenticate. This prevents accidental
production deploys from branches.

Preview deployments use a **separate IAM binding** on the same deployer service
account. This binding allows any GitHub Actions workflow from `noaraz/sudoku-battle`
to authenticate — including PR workflows. The two bindings are independent:
adding preview support does not weaken production deploy security.

## One-Time Setup (already done)

The following was configured once by the developer before this feature was merged:

- WIF IAM binding for PRs added to `sudoku-battle-deployer` SA (scoped to this repo)
- `roles/datastore.importExportAdmin` granted to `sudoku-battle-deployer` SA
- GCS bucket `gs://sudoku-battle-firestore-exports` created in `me-west1`
- `sudoku-battle-deployer` SA granted `roles/storage.admin` on the export bucket
- Firestore service account granted `roles/storage.admin` on the export bucket
- `FIRESTORE_DATABASE` env var supported in backend (defaults to `"(default)"`)

See the implementation plan for the exact `gcloud` commands:
`docs/superpowers/plans/2026-04-27-cloud-run-preview-deployments.md`
