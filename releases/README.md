# Releases

One directory per POSI-R platform release, each holding the reviewed
`manifest.json` defined in [POSI-R-1.0-SPEC.md](../POSI-R-1.0-SPEC.md) § 4.

| Release | Published | Data cutoff | Contents |
|---|---|---|---|
| [POSI-R-2026.1](./POSI-R-2026.1/manifest.json) | 2026-09-27 | 2026-09-27 | First official release: Core Collection, Global Benchmark, PCS, PCI, Citation Q and the PCS-Q 2026 ranking edition |

Official releases are cut once a year, in December. Between releases the
data keeps updating: snapshots built from newer data are published as
`post_release_data_snapshot`, naming the release they follow, and are not
releases themselves.

A manifest is committed once and never edited. A correction is a new
revision (`POSI-R-2026.2`, …) whose `supersedes` names the release it
corrects.

`files` records the SHA-256 of every collection file the release
contains. `scripts/publish-data-snapshot.mjs` publishes a snapshot as the
release only when its collections match these checksums exactly, so the
release is defined by its content. `data_commit` is the posi-data commit
the release was generated from; the commit that adds the manifest itself
changes no data.
