# Contract Specialist Reference — Practice Area: Contracts

This reference powers the Contract Specialist agent for Weybre AI. It contains the methodology, checklists, risk frameworks, and substantive knowledge needed to perform expert-level contract review and analysis.

---

## 1. Contract Review Methodology

### Systematic Reading Protocol

Read every contract in this order. Do not skip sections or jump ahead.

1. **Identify the Parties** — Who is signing? Legal entity names, jurisdiction of incorporation, capacity (individual vs entity). Flag any mismatch between the entity name in the preamble and the signature block.
2. **Read the Recitals (Whereas Clauses)** — These frame the intent. They are not operative but courts use them to interpret ambiguity. Note any factual assertions that could become contentious.
3. **Definitions Section** — This is where deals are won or lost. Every capitalized term controls meaning downstream. Pay special attention to:
   - "Affiliate" (how broad?)
   - "Confidential Information" (what's included/excluded?)
   - "Intellectual Property" (does it capture pre-existing IP?)
   - "Material Adverse Effect" / "Material Breach" (who decides materiality?)
   - "Change of Control" (does it include indirect changes?)
4. **Operative Provisions** — The "business deal." What each party must do, pay, deliver, and by when. Map obligations to timelines.
5. **Representations and Warranties** — Factual assertions each party makes. Check for knowledge qualifiers ("to the best of Party's knowledge") and materiality qualifiers that dilute protection.
6. **Covenants** — Ongoing obligations (affirmative and negative). Check duration and whether they survive termination.
7. **Conditions Precedent** — What must happen before obligations kick in. Missed conditions = no deal.
8. **Indemnification** — Who pays when things go wrong. Check scope, caps, baskets, escrow, and survival periods.
9. **Limitation of Liability** — Caps on damages, exclusion of consequential/indirect damages. This is the economic backstop of the entire agreement.
10. **Termination** — For cause, for convenience, automatic. What triggers it, what notice is required, what survives.
11. **Boilerplate** — Not boilerplate at all. See Section 7 below. Every clause here has operational impact.
12. **Schedules, Exhibits, and Annexes** — Often contain the actual deal terms (pricing, SLAs, specifications). Never treat these as secondary.

### Separating the Business Deal from Legal Terms

- **Business deal**: Scope of work/services, pricing, payment terms, delivery timelines, performance metrics, exclusivity, territory
- **Legal terms**: Risk allocation (indemnification, liability caps), IP ownership, termination mechanics, dispute resolution, governing law
- When reviewing, first confirm the business deal matches what the client expects, then assess whether the legal terms adequately protect the client's position in that deal.

---

## 2. Risk Matrix Format

Use this format for every contract review output:

| Section | Clause | Risk Level | Issue | Recommendation | Priority |
|---------|--------|------------|-------|----------------|----------|
| Section ref | Clause name/number | HIGH/MEDIUM/LOW | Description of the risk | Specific action or redline language | P1/P2/P3 |

### Risk Level Classification

**HIGH** — Any of:
- Unlimited or uncapped financial exposure
- Loss of IP rights or ownership
- One-sided termination with no cure period
- Missing limitation of liability entirely
- Unlimited indemnification obligation
- Automatic renewal with no opt-out notice mechanism
- Broad assignment rights allowing transfer to competitors
- Non-compete or non-solicit that could cripple business operations
- Waiver of material legal rights (jury trial, class action, consequential damages recovery)

**MEDIUM** — Any of:
- Liability cap set above market standard (e.g., more than 12 months of fees for SaaS)
- Indemnification scope broader than typical but still capped
- Termination for convenience with less than 30 days notice
- Auto-renewal with short opt-out window (less than 30 days)
- Governing law/venue in unfavorable jurisdiction
- Ambiguous definitions that could be interpreted broadly
- Missing provisions that are standard but not critical
- Audit rights without reasonable notice or frequency limits

**LOW** — Any of:
- Minor deviations from market standard that have limited financial impact
- Boilerplate language that could be tightened but poses minimal risk
- Formatting or organizational issues
- Provisions that are slightly one-sided but within normal negotiating range

### Priority Classification

- **P1**: Must be resolved before signing. Deal-breakers or unacceptable risk.
- **P2**: Should be negotiated. Meaningful risk that warrants pushback.
- **P3**: Nice to have. Standard improvement that may not be worth spending negotiating capital on.

---

## 3. Contract Types & Key Provisions

### SaaS / Software Agreements

**Key provisions to examine:**
- **Service Level Agreement (SLA)**: Uptime commitment (99.9% is standard; 99.99% is premium). Measurement period (monthly vs annual matters enormously). Exclusions from downtime calculation (scheduled maintenance, force majeure, customer-caused). Remedy for breach (service credits are standard; right to terminate is better).
- **Service Credits**: Typical structure is 5-10% of monthly fee per percentage point below SLA. Check if credits are sole remedy or in addition to other remedies. Credits should not be capped below meaningful amounts.
- **Data Handling**: Who owns the data? (Customer must own customer data — always.) What happens to data on termination? (Transition period + deletion certification.) Data processing addendum for GDPR/CCPA. Sub-processor approval rights. Data breach notification timeline (72 hours for GDPR, contractual requirement of 24-48 hours is better practice). Data residency requirements.
- **IP Ownership**: Customer owns its data and pre-existing IP. Vendor owns the platform and any improvements. Gray area: custom configurations, integrations, reports built on customer data. Ensure no broad IP assignment to vendor.
- **Limitation of Liability**: Standard cap is 12 months of fees paid or payable. Carve-outs from the cap should include: IP infringement indemnity, confidentiality breach, data breach, willful misconduct, gross negligence. Exclusion of consequential damages should be mutual.
- **Indemnification**: Vendor should indemnify for IP infringement claims. Customer should indemnify for misuse. Check for knowledge qualifiers and materiality thresholds.
- **Auto-Renewal**: Standard is 1-year auto-renewal with 30-60 day opt-out notice. Flag anything with less than 30 days notice. Flag price increase provisions on renewal (should require advance notice and cap on percentage increase).
- **Termination**: For cause with 30-day cure period is standard. Check for termination for convenience rights (should be mutual if present). Data portability and transition assistance on termination.

### Master Service Agreements (MSA)

**Key provisions to examine:**
- **SOW Structure**: MSA sets the legal framework; SOWs define individual engagements. Ensure SOW template is attached or referenced. Hierarchy of documents clause (if conflict, which controls? MSA should generally prevail for legal terms; SOW for scope/pricing).
- **Change Orders**: Process for modifying scope, timeline, or cost. Require written mutual agreement. No "deemed acceptance" of change orders. Impact on timeline and fees must be documented.
- **Acceptance Criteria**: Define objective, measurable acceptance criteria for deliverables. Acceptance testing period (typically 10-30 business days). Deemed acceptance clauses (flag these — require affirmative written acceptance instead). Rejection must include specific written reasons. Cure period for rejected deliverables.
- **Milestone Payments**: Tie payment to acceptance of deliverables, not just delivery. Holdback percentage until final acceptance (10-15% is standard). Right to withhold payment for non-conforming deliverables.
- **Warranties**: Deliverables will conform to specifications/SOW for a warranty period (90 days is standard, push for 12 months). Services performed in professional and workmanlike manner. Compliance with applicable laws.
- **Personnel**: Right to approve key personnel. Right to request removal of underperforming resources. Non-solicitation of personnel (mutual, reasonable duration).

### Non-Disclosure Agreements (NDAs)

**Key provisions to examine:**
- **Mutual vs Unilateral**: Mutual NDAs are standard for business discussions. Unilateral only when one party is clearly the sole discloser (e.g., due diligence).
- **Definition of Confidential Information**: Should be specific enough to be enforceable but broad enough to cover what matters. Include written/oral/visual. Marking requirements (if required, ensure oral disclosures can be confirmed in writing within a reasonable period, typically 10-30 days).
- **Standard Carve-Outs**: Publicly available information, independently developed, received from third party without restriction, already known prior to disclosure. These are non-negotiable — reject any NDA missing them.
- **Term**: Obligation duration vs agreement duration. Information should remain confidential for 2-5 years after disclosure (longer for trade secrets — consider perpetual for true trade secrets). Agreement term of 1-3 years for the relationship.
- **Residuals Clause**: Permits use of general knowledge, ideas, concepts retained in unaided memory. This is a significant carve-out — flag it if present when protecting sensitive IP. Acceptable in mutual NDAs for general business discussions.
- **Non-Solicitation Riders**: Some NDAs include non-solicitation of employees. Flag as scope creep if unexpected. If included, ensure it is mutual and reasonably limited (12-18 months, direct solicitation only, not general advertising).
- **Required Disclosures**: Carve-out for legally compelled disclosure (court order, subpoena, regulatory). Require notice to discloser before complying (to the extent legally permitted). Disclose only what is legally required.
- **Return/Destruction**: Obligation to return or destroy confidential information on termination. Right to retain copies required by law, regulation, or internal compliance policies. Certification of destruction.

### Employment Agreements

**Key provisions to examine:**
- **At-Will Language**: In most US states, employment is at-will. Ensure the agreement does not inadvertently create a fixed-term employment (unless intended). At-will language should be clear and conspicuous.
- **Compensation Structure**: Base salary, bonus (discretionary vs formula-based), commission structure. If bonus is "discretionary," it truly is — flag if client expects guaranteed bonus. Clawback provisions on bonuses.
- **Equity/Options**: Type of equity (ISO vs NSO, restricted stock, RSUs, phantom equity, profits interests). Vesting schedule (standard: 4-year vest, 1-year cliff). Acceleration provisions (single trigger vs double trigger on change of control). Exercise period post-termination (standard: 90 days for options; push for longer). 409A valuation for strike price. Repurchase rights on unvested/vested shares.
- **Restrictive Covenants**: Non-compete (jurisdiction matters enormously — unenforceable in California; narrow in most states; check FTC rule status). Non-solicitation of customers and employees (more enforceable, should be 12-18 months). Non-disparagement (should be mutual). Reasonableness of scope, geography, and duration.
- **IP Assignment (PIIA)**: All work product created in scope of employment assigned to employer. Prior inventions schedule (employee lists pre-existing IP to exclude). Flag overly broad assignment that captures work outside employment scope. State-specific carve-outs (California Labor Code 2870, etc.).
- **Severance Triggers**: Termination without cause or resignation for good reason. Define "cause" narrowly (fraud, felony conviction, material breach after cure period, willful misconduct). Define "good reason" broadly (material reduction in comp, relocation beyond X miles, material diminution of duties). Severance quantum (typical: 3-12 months base salary + COBRA continuation + acceleration of equity).

### Vendor / Supplier Agreements

**Key provisions to examine:**
- **Performance Standards**: Specific, measurable KPIs. Reporting frequency. Remedies for underperformance (cure period, service credits, escalation, termination right).
- **Termination for Convenience**: Standard in vendor agreements. Require 30-60 day notice. Wind-down obligations. Payment for work completed through termination date.
- **Audit Rights**: Right to audit vendor's performance, compliance, and records. Reasonable advance notice (15-30 days). Frequency limits (typically annual, or more if deficiencies found). Vendor bears cost if audit reveals material non-compliance.
- **Insurance Requirements**: Minimum coverage amounts (general liability, professional liability/E&O, cyber liability, workers' comp). Additional insured endorsement. Certificate of insurance. Notice of cancellation or material change.
- **Most Favored Customer**: Pricing no less favorable than other similarly situated customers. Audit rights to verify. Retroactive adjustment if violated.

### Partnership / Joint Venture Agreements

**Key provisions to examine:**
- **Capital Contributions**: Initial and additional contributions. Consequences of failure to contribute (dilution, forfeiture, default interest). Capital call mechanics and notice requirements.
- **Profit/Loss Sharing**: Distribution waterfall (return of capital, preferred return, then split). Tax distribution provisions. Timing and frequency of distributions.
- **Management Rights**: Who manages day-to-day? Major decisions requiring unanimous or supermajority consent. Management committee composition and voting. Officer appointments.
- **Deadlock Provisions**: Escalation procedures. Mediation/arbitration. Buy-sell mechanisms (shotgun clause, Texas shootout, Russian roulette). Dissolution as last resort.
- **Exit Mechanisms**: Tag-along and drag-along rights. Right of first refusal on transfers. Put and call options. Valuation methodology for buyouts (agreed formula, independent appraiser, or fair market value).
- **Non-Compete / Exclusivity**: Scope of the venture's exclusive business. Restrictions on partners competing. Carve-outs for existing businesses. Duration post-exit.

### License Agreements

**Key provisions to examine:**
- **Scope of License**: Exclusive vs non-exclusive. Field of use restrictions. Territory. Duration. Sublicensing rights (if any, with what controls).
- **Royalties**: Rate structure (percentage of net revenue, per-unit, flat fee). Definition of "net revenue" (deductions for returns, taxes, shipping). Minimum royalty commitments. Most favored licensee provisions.
- **Audit Rights**: Right to audit royalty calculations. Frequency (annual). Independent accountant. Underpayment threshold triggering licensor-paid audit (typically 5% or more).
- **Quality Control**: Licensor's right to approve quality of licensed products. Approval process for marketing materials. Right to inspect manufacturing. Consequences of quality failure.
- **Termination Triggers**: Breach. Bankruptcy/insolvency. Change of control. Failure to meet minimum royalties. Sell-off period for existing inventory after termination.

---

## 4. Standard vs Non-Standard Provisions

### What is "Market"

**Standard (expected in virtually every commercial contract):**
- Mutual confidentiality obligations
- Mutual indemnification for breach of reps/warranties
- Limitation of liability with reasonable cap (12 months fees for SaaS)
- Mutual exclusion of consequential damages
- Termination for cause with 30-day cure period
- Governing law clause
- Entire agreement / integration clause
- Assignment requires consent (not to be unreasonably withheld)
- Notice provisions with addresses and methods
- Severability clause
- Waiver requires writing

**Non-Standard (demands close attention):**
- Unilateral termination for convenience by only one party
- Liability cap exceeding 24 months of fees
- No limitation of liability at all
- Indemnification for third-party claims with no cap or basket
- Broad assignment rights without consent
- Unilateral amendment rights
- Liquidated damages provisions
- Most favored customer/nation clauses
- Non-compete or exclusivity obligations
- Equity or revenue sharing arrangements
- Escrow requirements
- Performance bonds or letters of credit
- Personal guarantees

---

## 5. Missing Provisions Checklist

### Universal (All Contract Types)

- [ ] Limitation of liability (RED FLAG if missing)
- [ ] Indemnification
- [ ] Termination for cause with cure period
- [ ] Confidentiality (or reference to separate NDA)
- [ ] Governing law and dispute resolution
- [ ] Force majeure
- [ ] Assignment restrictions
- [ ] Notice provisions
- [ ] Entire agreement clause
- [ ] Severability
- [ ] Survival clause

### Technology / SaaS Specific

- [ ] Data ownership and portability (RED FLAG if missing)
- [ ] Data processing / privacy provisions (RED FLAG if missing)
- [ ] Security obligations and breach notification
- [ ] SLA with measurable uptime commitment
- [ ] Service credits or other SLA remedies
- [ ] IP ownership for custom work
- [ ] Escrow for source code (if critical dependency)
- [ ] Transition assistance on termination
- [ ] Data deletion/return on termination
- [ ] Subcontractor/sub-processor restrictions
- [ ] Insurance requirements (cyber liability)
- [ ] Compliance with accessibility standards

### Employment Specific

- [ ] IP assignment / PIIA (RED FLAG if missing)
- [ ] At-will statement (or fixed-term terms)
- [ ] Restrictive covenants (non-compete, non-solicit)
- [ ] Equity vesting schedule and acceleration terms
- [ ] Severance provisions
- [ ] Dispute resolution (arbitration clause common)
- [ ] Clawback provisions for bonuses/equity
- [ ] Prior inventions schedule

### Services / MSA Specific

- [ ] Acceptance criteria for deliverables
- [ ] Change order process
- [ ] Warranty on deliverables
- [ ] Insurance requirements
- [ ] Background check / security clearance provisions
- [ ] Subcontractor approval rights

---

## 6. Negotiation Position Framework

### Identifying Leverage

- **Buyer leverage**: Multiple competitive options, large deal size, reference customer value, long-term commitment, strategic partnership potential
- **Seller leverage**: Proprietary/unique technology, switching costs, time pressure on buyer, regulatory requirements only seller meets, existing integration depth
- **Neutral**: Standard commercial relationship, competitive market, balanced deal size

### Standard Pushback Language

**For unlimited liability:**
> "We propose capping aggregate liability at [12/24] months of fees paid or payable under this Agreement, with customary carve-outs for indemnification obligations, IP infringement, confidentiality breach, and willful misconduct."

**For one-sided indemnification:**
> "We propose mutual indemnification obligations, with each party indemnifying the other for breaches of its representations, warranties, and obligations under this Agreement."

**For broad IP assignment:**
> "We propose that IP assignment be limited to deliverables specifically created for [Client] under a Statement of Work, and that all pre-existing IP and general knowledge, skills, and experience remain with the originating party."

**For auto-renewal without adequate notice:**
> "We propose a mutual right to terminate at the end of any renewal term upon [60] days' prior written notice, with written confirmation of renewal terms including any pricing changes."

**For unilateral amendment:**
> "We propose that amendments require mutual written agreement of both parties. For SaaS terms of service, we propose [30] days' advance notice of material changes with a right to terminate if changes are materially adverse."

**For overly broad non-compete:**
> "We propose narrowing the non-compete to [specific competitive activities] within [geographic scope] for a period of [12] months following termination, with a carve-out for [pre-existing business activities]."

### Negotiation Priority Tiers

**Must-Have (walk away if not achieved):**
- Reasonable liability cap
- Mutual termination for cause with cure period
- Data ownership and portability (tech agreements)
- IP ownership clarity
- Adequate cure periods before termination

**Nice-to-Have (negotiate firmly but can concede):**
- Favorable governing law/venue
- Broader indemnification carve-outs from liability cap
- Longer termination notice periods
- More favorable payment terms
- Audit rights with favorable frequency

**Standard Concession (give to gain elsewhere):**
- Specific governing law (if both jurisdictions are reasonable)
- Minor adjustments to notice periods
- Formatting and organizational preferences
- Specific insurance coverage amounts within reasonable range
- Arbitration vs litigation (depending on client preference)

---

## 7. Boilerplate That Matters

### Governing Law and Venue

- **Why it matters**: Determines which state's laws interpret the contract and where disputes are litigated. Home court advantage is real — local counsel costs, jury composition, judge familiarity.
- **Best position**: Your client's home state. Acceptable: neutral state (Delaware for corporate, New York for commercial).
- **Watch for**: Mandatory arbitration combined with unfavorable venue. Forum selection clauses that waive right to challenge jurisdiction.

### Dispute Resolution

- **Arbitration**: Faster, private, limited discovery, limited appeal rights. Favors the party with more resources if arbitration is expensive. Check: AAA vs JAMS vs ICC rules. Number of arbitrators (1 for small disputes, 3 for large). Who bears costs.
- **Litigation**: Public record, full discovery, appeal rights, jury trial option. Better for the party that benefits from precedent or public pressure.
- **Class Action Waivers**: Increasingly common in consumer and employment agreements. Enforceability varies by jurisdiction and context.
- **Escalation clauses**: Require good-faith negotiation (15-30 days), then mediation, then arbitration/litigation. Useful to avoid unnecessary disputes.

### Assignment

- **Why it matters**: Controls whether a party can transfer the contract (and its obligations) to a third party. Critical in M&A — a "change of control" counts as an assignment in many contracts.
- **Best position**: Require written consent for assignment, not to be unreasonably withheld. Include change of control as a triggering event. Carve-out for assignment to affiliates or in connection with a merger (for your client's flexibility).
- **Watch for**: Silent on assignment (default rules vary by jurisdiction). Permits assignment to "affiliates" without defining affiliate. No change of control trigger.

### Force Majeure

- **Post-COVID expansion**: Pandemics, epidemics, government-mandated shutdowns, supply chain disruptions, and public health emergencies are now commonly listed. Review whether the clause is broad enough for current risks.
- **Key elements**: List of qualifying events (specific is better than vague). Notice requirement within X days. Obligation to mitigate. Duration cap (if force majeure continues beyond X months, right to terminate). No excuse for payment obligations (this is standard and important).
- **Watch for**: Catch-all language without any specificity. No mitigation obligation. No termination right if event persists.

### Entire Agreement (Integration Clause)

- **Why it matters**: Kills all prior negotiations, side letters, oral promises, and email commitments. Everything not in the four corners of the document is legally irrelevant.
- **Implication**: If the client was promised something verbally or via email during negotiations, it must be in the contract or it does not exist. Review with client before signing.
- **Watch for**: Entire agreement clause that references "and the policies posted at [URL]" — this incorporates external, unilaterally changeable documents.

### Survival

- **Why it matters**: Specifies which obligations continue after the contract terminates or expires. Without a survival clause, obligations may end with the contract.
- **Should survive**: Confidentiality, indemnification, limitation of liability, IP ownership, governing law/dispute resolution, audit rights (for a reasonable period post-termination), payment obligations for services rendered.
- **Watch for**: No survival clause at all (ambiguity). Survival of non-compete or exclusivity obligations beyond reasonable period.

### Notices

- **Why it matters**: Determines how formal communications (termination notices, breach notices, amendment proposals) must be delivered. A notice sent to the wrong address or by the wrong method is not legally effective.
- **Best practice**: Require written notice via email (with confirmation) AND physical mail. Specify addresses. Require advance notice of address changes.

---

## 8. Red Flags Checklist

Flag any of the following immediately as HIGH risk:

1. **One-sided indemnification** — Only one party indemnifies; the other has no reciprocal obligation
2. **Unlimited liability** — No cap on total liability exposure
3. **No limitation of liability clause at all** — The entire contract is silent on liability caps
4. **Non-mutual termination rights** — One party can terminate for convenience; the other cannot
5. **Automatic renewal without adequate opt-out notice** — Less than 30 days notice required, or no notice mechanism specified
6. **Broad IP assignment beyond deliverables** — Assignment captures pre-existing IP, background IP, or work outside the engagement scope
7. **Overly broad non-compete** — Scope, geography, or duration exceeds what is reasonable and enforceable
8. **Liquidated damages without cap** — Penalty provision with no ceiling on exposure
9. **Unilateral amendment rights** — One party can modify terms without the other's consent
10. **Waiver of jury trial** — When the waiving party would benefit from a jury (e.g., individual vs large corporation)
11. **Broad definition of "confidential information" covering everything** — No carve-outs for public information, independently developed, etc.
12. **No cure period for breach** — Immediate termination right without opportunity to fix
13. **Personal guarantee by individual for corporate obligation** — Unless specifically intended and understood
14. **Cross-default provisions** — Default in one agreement triggers default in all other agreements between the parties
15. **Most favored nation clause without audit mechanism** — Promise of best pricing with no way to verify
16. **Exclusivity without performance minimums** — Exclusive relationship with no obligation to actually perform or purchase
17. **Non-solicitation disguised as non-compete** — Prohibits hiring anyone who "independently applies" (that is a non-compete, not a non-solicit)
18. **Governing law of a foreign jurisdiction without justification** — Unexpected choice of law that disadvantages the client
19. **Mandatory arbitration with class action waiver in employment context** — May be unenforceable; requires jurisdiction-specific analysis
20. **No data portability or transition assistance** — For tech/SaaS agreements, client is locked in with no exit path
21. **Vendor can use customer data for its own purposes** — Aggregation, benchmarking, marketing without explicit consent
22. **Insurance requirements without verification mechanism** — Required to maintain insurance but no certificate or notification obligations
23. **Entire agreement clause incorporating external URL policies** — Terms can change unilaterally by updating a webpage
24. **Cap on liability set below a single month's fees** — Effectively no meaningful remedy for breach
25. **Indemnification survives without time limit** — Open-ended indemnification exposure with no sunset
26. **Acceleration of all future payments on termination** — Full contract value becomes due even if terminated early for cause
27. **Right to withhold payment for disputed invoices is waived** — Must pay even contested amounts, then dispute after
28. **Source code escrow with no trigger events defined** — Escrow exists but no defined mechanism to access it
29. **Warranty disclaimer in ALL CAPS but no affirmative warranties** — All risk shifted to one party with no baseline quality commitment
30. **Anti-assignment clause that does not bind the drafter** — Asymmetric restriction on transfer

---

## Usage Notes for the Contract Specialist Agent

When analyzing a contract:
1. Read the entire document using the systematic protocol in Section 1.
2. Build the risk matrix (Section 2) as you identify issues.
3. Cross-reference against the relevant contract type in Section 3.
4. Check for non-standard provisions using Section 4.
5. Run the missing provisions checklist from Section 5.
6. Scan for every item in the Red Flags Checklist (Section 8).
7. For any HIGH or MEDIUM risk items, draft alternative language using the Negotiation Position Framework (Section 6).
8. Note any boilerplate issues using Section 7.
9. Produce a final output with: Executive Summary, Risk Matrix, Detailed Analysis, Missing Provisions, and Recommended Redlines.
