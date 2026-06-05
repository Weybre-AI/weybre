# Weybre AI — IRAC Methodology Reference

The backbone of all legal analysis performed by the firm. Every substantive legal question passes through this framework.

---

## 1. IRAC Framework Overview

IRAC stands for **Issue, Rule, Application, Conclusion**. It is the standard analytical framework used in legal reasoning. Every legal question — no matter how simple or complex — can be broken into these four components.

### Issue

State the legal question with precision. The issue frames everything that follows.

**Bad**: "Is this contract valid?"
**Good**: "Whether the non-compete clause in Section 4.2 of the Employment Agreement dated January 15, 2024, is enforceable under California Business and Professions Code ss 16600."

**Bad**: "Can they fire the employee?"
**Good**: "Whether termination of Employee for off-duty social media posts constitutes wrongful termination in violation of public policy under California Labor Code ss 96(k) and ss 98.6."

Principles for issue spotting:
- Identify the specific legal doctrine or statute at play
- Name the parties and their roles
- Reference the specific contract section, statute, or action at issue
- Frame as a "Whether..." statement
- Include the jurisdiction
- If the answer depends on a factual determination, state the factual predicate ("Assuming the parties did not execute a written modification...")

### Rule

State the applicable law. This is where you lay the legal foundation.

Components of a complete rule statement:
1. **Statutory text** — Quote or paraphrase the relevant statute
2. **Judicial interpretation** — How courts have interpreted and applied the statute
3. **Elements or factors** — The test courts use (elements = all required; factors = balancing)
4. **Standard of review** — How a court evaluates the issue (de novo, abuse of discretion, etc.)
5. **Burden of proof** — Who bears it and what standard (preponderance, clear and convincing, beyond reasonable doubt)
6. **Exceptions and defenses** — Affirmative defenses, statutory exceptions, safe harbors

Example rule statement:
> California Business and Professions Code ss 16600 provides that "every contract by which anyone is restrained from engaging in a lawful profession, trade, or business of any kind is to that extent void." [VERIFY] The California Supreme Court in *Edwards v. Arthur Andersen LLP*, 44 Cal.4th 937 (2008) [VERIFY], held that ss 16600 invalidates all non-compete agreements except the narrow statutory exceptions in ss 16601 (sale of business), ss 16602 (dissolution of partnership), and ss 16602.5 (dissolution of LLC). [VERIFY] California courts apply this prohibition broadly, rejecting the "narrow restraint" doctrine accepted in other jurisdictions. The burden is on the party seeking to enforce the covenant to demonstrate that a statutory exception applies.

### Application

Apply the rule to the specific facts. This is the analytical core — where legal reasoning lives.

Principles:
- Use fact-to-rule mapping: take each element/factor and match it to specific facts
- Use "here" and "in this case" language to anchor analysis to the facts
- Address BOTH sides — what supports the position AND what undermines it
- Use analogical reasoning: compare to cited cases (distinguishing unfavorable ones)
- Identify factual gaps that could change the analysis
- Quantify where possible (dollar amounts, time periods, geographic scope)

Example application:
> Here, the Employment Agreement contains a two-year non-compete clause (Section 4.2) prohibiting Employee from working for any competitor within the United States. Applying *Edwards*, this clause falls squarely within the prohibition of ss 16600 because it restrains Employee from engaging in her profession as a software engineer. The clause does not fall within any of the three statutory exceptions: Employee is not selling a business (ss 16601), dissolving a partnership (ss 16602), or dissolving an LLC (ss 16602.5). Employer may argue the clause is narrowly tailored because it only prohibits work for "direct competitors," but California courts have consistently rejected the narrow-restraint exception. See *Edwards*, 44 Cal.4th at 948 [VERIFY]. The choice-of-law provision selecting Delaware law (Section 12.1) is unlikely to save the clause, as California courts have held that ss 16600 reflects a fundamental public policy that overrides contractual choice-of-law provisions. See *Application Group, Inc. v. Hunter Group, Inc.*, 61 Cal.App.4th 881 (1998) [VERIFY].

### Conclusion

State the likely outcome with a confidence level. Be direct.

Format: "It is [highly likely / likely / uncertain] that [conclusion]. **Confidence: [HIGH / MEDIUM / LOW]**."

Example:
> It is highly likely that the non-compete clause in Section 4.2 is void and unenforceable under California law. The clause constitutes an unrestricted restraint on Employee's ability to practice her profession, and no statutory exception applies. Even if Employer invokes the Delaware choice-of-law provision, California courts will likely apply ss 16600 as a fundamental public policy. **Confidence: HIGH.**

---

## 2. Advanced IRAC Patterns

### 2.1 Nested IRAC

For complex issues with sub-issues, use nested IRAC. The main issue generates sub-issues, each analyzed with its own IRAC cycle.

Structure:
```
MAIN ISSUE: Whether the Employment Agreement is enforceable.
  SUB-ISSUE 1: Whether the non-compete clause is enforceable.
    I: [specific to non-compete]
    R: [non-compete law]
    A: [application to facts]
    C: [conclusion on non-compete]
  SUB-ISSUE 2: Whether the non-solicitation clause is enforceable.
    I: [specific to non-solicitation]
    R: [non-solicitation law]
    A: [application to facts]
    C: [conclusion on non-solicitation]
  SUB-ISSUE 3: Whether the IP assignment clause is valid.
    I: [specific to IP assignment]
    R: [IP assignment law, Cal. Lab. Code ss 2870]
    A: [application to facts]
    C: [conclusion on IP assignment]
OVERALL CONCLUSION: [synthesize sub-conclusions]
```

### 2.2 Counter-Argument Integration

Every application section must address the opposing position. Use this structure:

> [Your primary analysis]
>
> However, opposing counsel would likely argue that [counter-argument]. Specifically, [factual or legal basis for counter-argument]. This argument [has merit because... / is unlikely to prevail because...]. In response, [rebuttal].

This is not optional. One-sided analysis is incomplete analysis.

### 2.3 Multi-Jurisdiction IRAC

When the same issue arises under different states' laws:

```
ISSUE: Whether the non-compete is enforceable.

JURISDICTION 1: California
  R: Cal. Bus. & Prof. Code ss 16600 — virtually per se unenforceable
  A: [apply to facts under CA law]
  C: Unenforceable. Confidence: HIGH.

JURISDICTION 2: Texas
  R: Tex. Bus. & Com. Code ss 15.50 — enforceable if ancillary to
     an otherwise enforceable agreement, reasonable in scope
  A: [apply to facts under TX law]
  C: Likely enforceable with modification. Confidence: MEDIUM.

JURISDICTION 3: New York
  R: Common law reasonableness test — enforced if reasonable in
     time, geography, and scope, and necessary to protect
     legitimate business interests
  A: [apply to facts under NY law]
  C: Partially enforceable (court likely to blue-pencil). Confidence: MEDIUM.

COMPARATIVE SUMMARY: [table comparing outcomes across jurisdictions]
```

### 2.4 Statutory Interpretation Framework

When a statute is ambiguous, apply this interpretive hierarchy:

1. **Plain Meaning** — Start with the text. If unambiguous, stop here.
2. **Statutory Context** — Read the provision in context of the entire statute and related statutes.
3. **Legislative History** — Committee reports, floor statements, sponsor commentary.
4. **Statutory Purpose** — What problem was the statute designed to solve?
5. **Canons of Construction** — ejusdem generis, noscitur a sociis, expressio unius, rule of lenity (criminal), liberal construction (remedial statutes).
6. **Agency Interpretation** — Chevron deference (federal) or state equivalent for agency regulations.
7. **Policy Considerations** — Constitutional avoidance, absurdity doctrine.

Apply each level in order. Note where different interpretive methods yield different results.

---

## 3. Confidence Assignment in IRAC

### At Each Step

| Step | What to Assess | Confidence Signal |
|------|---------------|-------------------|
| Issue | Is the legal question well-defined? | Vague issue = lower confidence in entire analysis |
| Rule | Is the law clear and settled? | Ambiguous statute or split authority = lower confidence |
| Application | Do the facts clearly map to the rule? | Factual gaps or disputed facts = lower confidence |
| Conclusion | How sensitive is the outcome to assumptions? | High sensitivity = lower confidence |

### When to Flag Uncertainty

- The controlling statute has not been interpreted by the relevant state's highest court
- Federal circuit split exists and the Supreme Court has not resolved it
- The relevant statute was recently enacted (< 3 years) with limited case law
- The facts are incomplete and the outcome is fact-dependent
- Multiple plausible interpretations exist with reasonable support for each
- An administrative agency has taken a position contrary to the prevailing case law

### Handling Split Authority

When courts disagree:
1. Identify the split (which courts on which side)
2. Assess the trend (is one side gaining traction?)
3. Identify the binding authority for the relevant jurisdiction
4. If no binding authority, identify the most persuasive authority and explain why
5. Assign LOW or MEDIUM confidence and explain the split
6. Recommend monitoring specific pending cases that may resolve the split

### When to Recommend Further Research

Flag for further research when:
- The analysis depends on facts not yet established
- The issue requires review of a specific contract, document, or record not provided
- Specialized expertise is needed (patent claim construction, tax code interpretation)
- The issue involves foreign law
- Recent legislative or regulatory developments may have changed the landscape
- The analysis would benefit from a formal legal opinion from retained counsel

---

## 4. Cross-Reference Analysis

### Provision Interaction Mapping

When one contract provision affects another:
1. Identify the trigger provision (the clause being analyzed)
2. Map all cross-references within the document (defined terms, incorporation by reference)
3. Identify dependent provisions (clauses that rely on the trigger provision)
4. Assess whether modification or invalidation of the trigger provision cascades

### Cascade Analysis

If Provision X fails, trace the consequences:

```
IF ss 4.2 (Non-Compete) is void:
  THEN ss 4.3 (Non-Solicitation) — may survive if independently enforceable
  THEN ss 4.4 (Garden Leave) — likely unaffected (separate consideration)
  THEN ss 4.5 (Clawback) — may be unenforceable if tied to non-compete breach
  THEN ss 12.3 (Severability) — determines whether void clause is severed or
       entire Section 4 fails
```

### Conflict Identification Between Documents

When reviewing multiple related documents:
1. Create a matrix of overlapping provisions (e.g., both the LLC Agreement and Employment Agreement address IP ownership)
2. Identify conflicts (Document A says X, Document B says Y)
3. Apply the document hierarchy to resolve conflicts
4. Flag irreconcilable conflicts for resolution by counsel

### Document Hierarchy

In descending order of authority:
1. Applicable law (statute, regulation) — always controls
2. Court orders and consent decrees
3. Articles of Incorporation / Certificate of Formation
4. Bylaws / Operating Agreement
5. Shareholder Agreement / Member Agreement
6. Board resolutions
7. Employment Agreements and offer letters
8. Company policies and handbooks (usually not contractual)
9. Course of dealing and custom

Later in time controls over earlier, within the same tier. Specific controls over general.

---

## 5. Risk Prioritization Framework

### Four-Tier Classification

#### NON-NEGOTIABLE (Red)
- Refuse to sign / must remediate immediately
- Criteria: creates existential legal risk, regulatory violation, or loss of critical rights
- Examples: unlimited personal liability, waiver of statutory rights, illegal provisions, uninsurable indemnification obligations
- Action: reject or require complete redraft of provision

#### NEGOTIATE HARD (Orange)
- Material risk that requires substantive revision
- Criteria: significant financial exposure, meaningful operational restriction, or unusual market terms
- Examples: uncapped liability, overly broad IP assignment, unreasonable non-compete scope, one-sided termination rights
- Action: propose specific alternative language; identify fallback position

#### RAISE BUT FLEXIBLE (Yellow)
- Moderate risk; acceptable with modification
- Criteria: below-market terms that create manageable risk, or standard terms that could be improved
- Examples: short cure periods, narrow limitation of liability carve-outs, imprecise defined terms
- Action: request modification; accept if counterparty pushes back with reasonable justification

#### ACCEPT (Green)
- Standard market terms with low risk
- Criteria: consistent with market practice, balanced allocation of risk, no unusual exposure
- Examples: standard reps and warranties, mutual indemnification, reasonable confidentiality obligations
- Action: accept as-is; note for file but do not negotiate

### Risk Assessment Factors

When assigning risk tier, consider:
- **Probability**: How likely is the risk to materialize?
- **Magnitude**: What is the financial or operational impact if it does?
- **Detectability**: Will you know if the risk materializes before damage is done?
- **Reversibility**: Can the damage be undone or mitigated after the fact?
- **Insurance**: Is the risk insurable?
- **Market standard**: Is this term typical for this transaction type?

---

## 6. Common Legal Analysis Patterns with IRAC Examples

### 6.1 Contract Enforceability

**Issue**: Whether the limitation of liability clause in Section 8.1 of the SaaS Agreement is enforceable under New York law.

**Rule**: Under New York law, limitation of liability clauses in commercial contracts between sophisticated parties are generally enforceable. *Metropolitan Life Ins. Co. v. Noble Lowndes Int'l*, 84 N.Y.2d 430 (1994) [VERIFY]. However, limitations that are unconscionable or that attempt to limit liability for gross negligence, willful misconduct, or fraud are unenforceable. *Kalisch-Jarcho, Inc. v. City of New York*, 58 N.Y.2d 377 (1983) [VERIFY]. Courts assess both procedural unconscionability (unequal bargaining power, lack of meaningful choice) and substantive unconscionability (unreasonably favorable terms).

**Application**: Here, Section 8.1 caps total liability at fees paid in the prior 12-month period. Both parties are commercial entities represented by counsel, reducing procedural unconscionability concerns. The cap does not purport to limit liability for gross negligence or willful misconduct, and Section 8.2 contains appropriate carve-outs for indemnification obligations and breaches of confidentiality. However, the cap applies to data breach liability, which could result in damages far exceeding 12 months of fees. A court might scrutinize this asymmetry if a significant data breach occurs.

**Conclusion**: It is likely that the limitation of liability clause is enforceable as written, though the application to data breach liability introduces some uncertainty. **Confidence: MEDIUM.**

### 6.2 Regulatory Compliance Gap Analysis

**Issue**: Whether Company's current data collection practices comply with the California Consumer Privacy Act (CCPA), Cal. Civ. Code ss 1798.100 et seq. [VERIFY].

**Rule**: The CCPA requires businesses to: (1) disclose categories of personal information collected and the purposes for collection at or before collection (ss 1798.100(b)); (2) provide a "Do Not Sell or Share My Personal Information" link (ss 1798.120); (3) honor opt-out requests within 15 business days (ss 1798.135); (4) respond to verifiable consumer requests to know or delete within 45 days (ss 1798.105, ss 1798.110). The CPRA amendments effective January 1, 2023 [VERIFY] added requirements for data minimization (ss 1798.100(c)) and created the California Privacy Protection Agency with enforcement authority.

**Application**: [Apply each requirement to Company's current practices, identifying gaps]

**Conclusion**: [Compliance matrix with gap analysis and remediation priorities]

### 6.3 Employment Classification Analysis

**Issue**: Whether Worker, engaged as an independent contractor under the Consulting Agreement, would be classified as an employee under California's ABC test (Cal. Lab. Code ss 2775) [VERIFY].

**Rule**: Under California's ABC test, codified by AB 5, a worker is presumed to be an employee unless the hiring entity demonstrates all three factors: (A) the worker is free from the control and direction of the hirer in the performance of the work; (B) the worker performs work outside the usual course of the hiring entity's business; and (C) the worker is customarily engaged in an independently established trade, occupation, or business of the same nature as the work performed. *Dynamex Operations West, Inc. v. Superior Court*, 4 Cal.5th 903 (2018) [VERIFY]. The burden is on the hiring entity to prove all three prongs.

**Application**: [Apply each prong A, B, C to the specific facts of the engagement]

**Conclusion**: [Classification determination with confidence level]

### 6.4 IP Ownership Determination

**Issue**: Whether Company owns the software code developed by Contractor during the engagement under the Consulting Agreement and applicable copyright law.

**Rule**: Under the Copyright Act, 17 U.S.C. ss 101 [VERIFY], a "work made for hire" exists in two circumstances: (1) work prepared by an employee within the scope of employment, or (2) work specially ordered or commissioned that falls into one of nine enumerated categories AND the parties have signed a written agreement designating it as work made for hire. Software code does not fall into any of the nine enumerated categories. *Community for Creative Non-Violence v. Reid*, 490 U.S. 730 (1989) [VERIFY]. Therefore, for independent contractors, a written assignment of copyright is required to transfer ownership.

**Application**: [Analyze whether the agreement contains proper IP assignment language]

**Conclusion**: [Ownership determination with confidence level]

---

## 7. Questions for Counsel — Formulation Guide

When analysis identifies issues requiring attorney input, structure the questions using this framework:

### Three-Position Framework

For each negotiation point or legal question:

**Ideal Position (Push For)**
- The outcome most favorable to the client
- What to ask for first in negotiation
- Example: "Strike the non-compete clause entirely"

**Acceptable Fallback**
- A compromise that adequately protects the client's interests
- What to accept if the ideal position is rejected
- Example: "Narrow non-compete to 6 months, within 25-mile radius, limited to direct competitors in the dental implant space"

**Walk-Away Position (Not Acceptable)**
- The minimum acceptable terms below which the deal is not worth doing
- Example: "Any non-compete exceeding 12 months or covering an industry-wide scope"

### Question Formulation Best Practices

- Frame questions to elicit actionable guidance, not abstract legal theory
- Provide the factual context the attorney needs to answer
- State what the analysis has already determined and where uncertainty remains
- Identify the business impact of each possible legal outcome
- Prioritize questions by urgency and materiality

Example well-formed question:
> Section 7.2 provides that Licensor may terminate for convenience on 30 days' notice. Our analysis indicates this is enforceable under New York law, but it creates significant operational risk given the 6-month integration timeline. **Question for counsel**: Can we negotiate a minimum term of 12 months before the convenience termination right activates? If Licensor rejects, would a 90-day notice period with a transition assistance obligation be an acceptable fallback?

---

## 8. IRAC Quality Standards

### Complete IRAC Checklist

- [ ] Issue stated as a precise "Whether..." question with jurisdiction identified
- [ ] Rule includes statutory text, judicial interpretation, and applicable test/standard
- [ ] Rule identifies burden of proof and who bears it
- [ ] Application addresses both sides of the argument
- [ ] Application uses specific facts (names, dates, dollar amounts, section numbers)
- [ ] Application distinguishes unfavorable authority rather than ignoring it
- [ ] Conclusion states a clear outcome with confidence level
- [ ] All citations tagged [VERIFY]
- [ ] Counter-arguments addressed
- [ ] Factual gaps identified

### Common IRAC Errors to Avoid

1. **Conclusory application**: "The facts clearly satisfy the test." (Why? How? Map fact to element.)
2. **Rule without source**: "The law requires reasonableness." (Which law? What statute? What case?)
3. **One-sided analysis**: Arguing only for one outcome without addressing counterarguments.
4. **Issue too broad**: "Is the company liable?" (For what? To whom? Under which theory?)
5. **Missing jurisdiction**: Analyzing enforceability without identifying which state's law applies.
6. **Assuming facts**: Treating disputed facts as established without noting the assumption.
7. **Skipping the rule**: Jumping from issue directly to "here, the facts show..." without stating the law.
8. **Circular reasoning**: "The clause is unenforceable because it is unreasonable, and it is unreasonable because it is unenforceable."

---

*This methodology is version 1.0. All analysis agents in the Weybre AI firm apply IRAC as the default analytical framework. Deviations require explicit justification.*
