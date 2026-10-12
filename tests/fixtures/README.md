# GEDCOM fixtures

Public sample trees used by the unit and visual tests. Only add files whose license allows redistribution; private trees belong in the git-ignored `ged/` folder.

All files come from [D-Jeffrey/gedcom-samples](https://github.com/D-Jeffrey/gedcom-samples) at commit `74040285d9e764d25d25c2f66ad1da710eeb391c`, unchanged apart from the file name. That repository is `MIT OR CC0-1.0`: files authored by D Jeffrey or with no author are CC0-1.0.

| File | Source path | People | Author | License |
|------|-------------|--------|--------|---------|
| `basic.ged` | `basic.ged` | 5 | D Jeffrey (fictional) | CC0-1.0 |
| `english-tudor-royal-family.ged` | `tudor/EnglishTudorRoyalFamily.ged` | 347 | D Jeffrey | CC0-1.0 |
| `washington-family.ged` | `washington/washington.ged` | 529 | not referenced | CC0-1.0 |

Only `basic.ged` is held to the full layout invariants; the larger trees get smoke checks (positions for everyone, no overlaps) until the layout handles them.
