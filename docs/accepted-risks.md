# Accepted Risks

## 2026-03-29

### Public order verification remains low-entropy by product decision

- Owner: Product / Engineering
- Decision date: 2026-03-29
- Scope: public lookup, public order unlock, payment report, cancel flow, and LINE binding still use `purchaser_name + phone_last3`
- Rationale: keep zero-registration UX for this release-hardening cycle while higher-severity delivery, auth-session, observability, and release-governance gaps are remediated first
- Known downside: the verifier is guessable/socially knowable and does not provide strong protection against a targeted attacker
- Revisit trigger: any privacy incident, expansion beyond the current low-volume/private audience, or the next auth redesign window
- Preferred replacement path when revisited: verified-channel OTP, full-phone verification plus one-time token, or signed per-order magic links
