# Common Hours release

Verified 2026-09-08.

## Public deliverables

- [Free full application](https://skailiner-common-hours.static.hf.space/index.html)
- [GitHub source](https://github.com/skailiner/common-hours)
- [Hugging Face Space and source](https://huggingface.co/spaces/skailiner/common-hours)

No login, API key or paid runtime is required. This is the complete local planner, not a static screenshot or reduced sample. Rosters remain temporary browser-local data.

## Functional source receipts

- GitHub release: 77f27e21834a92ea9deadfc8628cde819c7dd40f
- Hugging Face app/source release: 253e5a6aef3125081d1fd83660059f634f98f954

Both remote branch heads were verified after publishing. Later documentation-only commits add these receipts and do not change the tested application. Public source was sanitized before its first commit; private hosting identifiers and credentials are excluded.

## Verification

All 18 automated test groups, authored-file lint, TypeScript checks and the static production build passed. Independent actual-source mathematical and workflow audits are described in TESTING.md.

All four browser tools were checked in the real local app: expected names, schemas and annotations; successful read, roster replacement, planning and eligibility selection; and intentional invalid-field, malformed-roster, stale-revision and unknown-role failures. The repair café produced 8/8 positions, squared counts12, preference penalty2 and matching cost/dual bound110.

All 19 public static files were byte-matched to the staged Space before upload. The tracked-file scan covered114 files and found no credential-like or private hosting references.

Anonymous public delivery returned HTTP200. The HTML contained79,600 bytes; removing only the hosting provider's101-byte creator metadata script left the exact79,499-byte tested page. Three entry scripts, the stylesheet and the planner worker also matched byte for byte.

- Normalized HTML SHA256: 66aebd242614d5b5c0cfc885528604c24afe6de6e4fc746a42a81a43f098f6e4
- Stylesheet SHA256: d30ee7001de01c65b61e3c3f2509002697ed0f171324fc08846d915c5e74b583
- Planner worker SHA256: 476795d5ed8c3232bc2caacbcb3a3763a9df7c8bd28ee10b930d8073c1864d4e

## Real public calculation

A two-person, two-role fixture assigned the flexible X/Y-skilled person to Y and the X-only specialist to X:2/2 filled, squared counts2, preference penalty1, cost and dual bound7.

Locking the flexible person to X correctly reduced feasible coverage to1/2. The lock remained, Y was unfilled, and the certificate showed zero additional capacity. Eligibility inspection selected Y; a stale revision request was rejected. The fictional repair café was then restored with no result, editor, confirmation, operation or error left open.

## Publication boundaries

The free public Space uses Static hosting. No new paid service or social account was enabled. A separate owner-private Sites deployment also succeeded; its receipts remain in an ignored local record.

The unused Hugging Face starter stylesheet was removed. It remains recoverable in the Space's initial Git history. Existing large-file rules were preserved.

No broad visual, phone-device, screen-reader or dependency-security audit is claimed. A plan certifies only the declared model and objective, not safe staffing, consent, qualifications or legal compliance.

