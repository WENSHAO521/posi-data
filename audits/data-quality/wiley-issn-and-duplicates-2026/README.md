# Wiley: duplicate ids and print/online ISSN — 2026-10-11

## Duplicate ids from the monthly sync (#55)

Eight of the 17 journals the first monthly Wiley sync added already had an id:

| New id (superseded) | Id kept | Journal |
|---|---|---|
| POSI-J-027955 | POSI-J-000963 | Brain and Behavior |
| POSI-J-027950 | POSI-J-001247 | Diversity and Distributions |
| POSI-J-027945 | POSI-J-001614 | Canadian Journal of Infectious Diseases and Medical Microbiology |
| POSI-J-027944 | POSI-J-003617 | Carbon Energy |
| POSI-J-027947 | POSI-J-004466 | Animal Models and Experimental Medicine |
| POSI-J-027946 | POSI-J-007217 | Chronic Diseases and Translational Medicine |
| POSI-J-027949 | POSI-J-010177 | Interdisciplinary Medicine |
| POSI-J-027948 | POSI-J-015204 | Responsive Materials |

**Cause.** The older ids are registered on one ISSN-L (OpenAlex's, for example 2157-9032 for Brain and Behavior), which Crossref does not
list; the print and online ISSN written on the records were not registry keys either. The ingest script looked only at registry keys, so it did not
recognise the journals. Fixed in `scripts/ingest-crossref-publisher.mjs`: the ISSNs on the records (print, online, ISSN-L of every record not
superseded) are lookup keys too, and a new journal with the same normalised title as an existing record but no ISSN in common is held for review.
Replaying the sync's 17 candidates against the data as it was before #55 now recognises these eight and mints 9 ids.

The new ids are recorded in `registry/superseded-ids.csv` (the old registry rows stay) and their records are removed from
`journals/discovered/wiley-expansion-2026-10.jsonl`.

## Print and online ISSN swapped on seven records

Five were checked against the ISSN Centre's registry by the project owner (print / online):

| Id | Journal | Print | Online |
|---|---|---|---|
| POSI-J-003617 | Carbon Energy | 2096-9570 | 2637-9368 |
| POSI-J-004466 | Animal Models and Experimental Medicine | 2096-5451 | 2576-2095 |
| POSI-J-010177 | Interdisciplinary Medicine | 2832-6237 | 2832-6245 |
| POSI-J-014503 | Medicine Advances | 2834-4391 | 2834-4405 |
| POSI-J-015204 | Responsive Materials | 2834-894X | 2834-8966 |

The records had them the other way round; the ISSN-L on each record (2096-9570, 2096-5451, 2832-6237, 2834-4391, 2834-894X) is the print ISSN,
as the ISSN Centre gives it. POSI-J-001247 (Diversity and Distributions) and POSI-J-001614 (Canadian Journal of Infectious Diseases and Medical
Microbiology) were swapped the same way; their typed ISSNs in Crossref (print 1366-9516 / online 1472-4642; print 1712-9532 / online 1918-1493) were used.
Also checked and already right: Aggregate, InfoMat, SusMat, Smart Medicine (POSI-J-013709 had no print ISSN; the ISSN Centre's 2751-1863 is added).

Not changed: the registry keys (an ISSN change would not fix a lookup), and `title`.

## Not part of this change

Scanning every record for an ISSN shared by two active ids found about 60 older groups (mostly a record from the first migration and one from the
Elsevier and Frontiers expansions, for example Scientia Horticulturae POSI-J-000605 and 023668), and ISSN 2227-7072 on eleven different journals. They predate this work and are not touched here.
