# Senior Associate Reference — Practice Area: Corporate Governance

This reference powers the Senior Associate (corporate governance specialist) agent for Weybre AI. It contains the substantive legal knowledge needed to analyze governance structures, equity arrangements, entity formation, M&A transactions, and Delaware corporate law.

---

## 1. Corporate Governance Framework

### Board Composition and Structure

**Board Size and Composition:**
- Typical startup board: 3-5 members (common seats, investor seats, independent seats)
- Public company boards: 7-13 members, majority independent under NYSE/NASDAQ rules
- Odd number preferred to avoid deadlock on votes

**Staggered (Classified) Boards:**
- Directors divided into classes (typically 3), each serving staggered multi-year terms
- Effect: Hostile acquirer cannot replace entire board in a single election cycle
- Anti-takeover mechanism — makes proxy fights significantly harder
- Delaware law permits classification via certificate of incorporation or bylaws

**Board Committees:**
- **Audit Committee**: Financial oversight, external auditor relationship, internal controls. Must be 100% independent directors for public companies (SOX).
- **Compensation Committee**: Executive pay, equity plans, employment agreements. Independent directors required.
- **Nominating/Governance Committee**: Board composition, director qualifications, governance policies.
- **Special Committees**: Formed ad hoc for conflict transactions (related-party deals, going-private transactions, management buyouts). Must be independent and have independent counsel.

**Independent Directors:**
- No material relationship with the company (financial, familial, employment within last 3 years)
- Critical for conflict-of-interest transactions — cleansing effect under Delaware law
- MFW framework (Kahn v. M&F Worldwide): independent committee approval + majority-of-minority vote shifts review from entire fairness to business judgment

### Fiduciary Duties

**Duty of Care:**
- Directors must act with the care that a reasonably prudent person would use in similar circumstances
- Requires informed decision-making — directors must actually review materials, ask questions, and deliberate
- Protected by the business judgment rule (see below) and 102(b)(7) exculpation provisions
- Breach example: Approving a major transaction without reading the relevant materials or obtaining professional advice

**Duty of Loyalty:**
- Directors must act in the best interests of the corporation and its stockholders, not self-interest
- Cannot be exculpated under DGCL 102(b)(7) — this is the fiduciary duty with real teeth
- Self-dealing transactions require entire fairness review unless properly cleansed
- Corporate opportunity doctrine: Directors cannot usurp business opportunities that belong to the corporation
- Breach example: Director steering a corporate acquisition to a company they secretly own

**Business Judgment Rule:**
- Presumption that directors acted on an informed basis, in good faith, and in the honest belief that the action was in the company's best interest
- When the rule applies, courts will not second-guess the board's decision even if the outcome is bad
- Rebutted by: lack of independence, self-dealing, failure to inform themselves, bad faith, or waste
- Effect: Shifts the burden to the plaintiff to prove breach — very difficult to overcome

**Duty of Good Faith:**
- Subset of the duty of loyalty (Stone v. Ritter)
- Requires directors to actually attempt to fulfill their duties — not a passive role
- Breach includes: intentional dereliction of duty, conscious disregard of known risks (Caremark claims), acting with a purpose other than advancing the corporation's best interests
- Oversight liability (Caremark): Board must make good-faith effort to implement reporting systems and monitor them. Complete failure to do so = breach of good faith.

### Stockholder vs Member Rights

**Corporation (Stockholders):**
- Vote on directors, fundamental transactions (mergers, dissolution, charter amendments), equity plans
- Inspect books and records (DGCL 220 — proper purpose required)
- Appraisal rights in certain mergers (DGCL 262)
- Derivative suits on behalf of the corporation
- Annual meeting required; written consent actions permitted if not prohibited by charter

**LLC (Members):**
- Rights defined primarily by the operating agreement — the LLC Act is a default statute
- Members can contractually waive fiduciary duties (Delaware) — not possible in a corporation
- No statutory appraisal rights (must be negotiated in operating agreement)
- Greater flexibility in governance structure but less statutory protection
- Tax flexibility (pass-through by default, can elect corporate taxation)

### Voting Mechanics

- **Simple Majority**: More than 50% of votes cast. Standard for director elections and ordinary resolutions.
- **Supermajority**: Typically 66.7% or 75%. Used for charter amendments, mergers, dissolution, removal of directors (if staggered board).
- **Unanimous Consent**: Required for certain LLC actions under default rules. Can be modified by operating agreement.
- **Written Consent**: Action taken without a meeting. DGCL 228 permits stockholder written consent unless prohibited by charter. Board written consent requires unanimity (DGCL 141(f)).
- **Cumulative Voting**: Permits stockholders to concentrate all votes on one candidate. Not the default in Delaware — must be granted in the charter.
- **Class Voting**: Specific share classes vote separately on matters affecting their rights. Mandatory for certain charter amendments affecting class rights (DGCL 242(b)(2)).

---

## 2. Entity-Specific Analysis

### C-Corporation

**Key Documents:**
- **Certificate of Incorporation (Charter)**: Filed with Delaware Secretary of State. Establishes authorized shares, par value, board structure. Cannot be easily changed (requires board approval + stockholder vote).
- **Bylaws**: Internal governance rules. Board can amend unilaterally unless charter restricts. Cover meeting procedures, officer roles, indemnification, committee authority.
- **Stockholders' Agreement**: Contractual overlay. Voting agreements, transfer restrictions, ROFR, co-sale, drag-along, information rights. Binds signatories (not the corporation, unless the corporation is a party).
- **Board Resolutions**: Formal record of board approvals. Required for major corporate actions (equity issuance, debt incurrence, officer appointments, M&A approvals, dividends).

**Typical Issues to Analyze:**
- Is the authorized share count sufficient for the current cap table plus option pool?
- Does the charter include a 102(b)(7) exculpation provision? (It should.)
- Are protective provisions in the charter or the stockholders' agreement? (Charter provisions bind all stockholders including future ones; agreement provisions bind only signatories.)
- Is the stock ledger accurate and up to date?
- Have all equity issuances been properly authorized (board resolution, stockholder approval if required)?
- Section 83(b) elections filed for restricted stock grants?

### LLC (Limited Liability Company)

**Key Documents:**
- **Certificate of Formation**: Minimal filing with state. Names the LLC and registered agent.
- **Operating Agreement**: THE document. Governs everything — economics, governance, transfers, dissolution. Can override almost all default statutory rules in Delaware (DLLCA 18-1101(b)).

**Member-Managed vs Manager-Managed:**
- **Member-Managed**: All members participate in management. Voting typically proportional to ownership or capital contributions. Simpler structure for small LLCs.
- **Manager-Managed**: Designated manager(s) run day-to-day operations. Members are passive investors. More corporate-like structure. Common for investment vehicles and JVs.

**Capital Accounts:**
- Track each member's economic interest in the LLC
- Adjusted for contributions, distributions, allocated profits and losses
- Critical for tax reporting (Schedule K-1)
- Negative capital accounts can create tax issues

**Distribution Waterfalls:**
- Simple: Pro rata based on percentage interests
- Complex (common in PE/VC): Return of capital first, then preferred return (8-10% IRR), then catch-up to GP, then carried interest split (80/20 is standard)
- Tax distributions: Mandatory distributions to cover members' tax obligations from pass-through income
- Ensure operating agreement addresses timing, priority, and conditions for distributions

### S-Corporation

**Eligibility Restrictions:**
- Maximum 100 shareholders (certain family members counted as one)
- Only US citizens or resident aliens as shareholders
- One class of stock (voting differences permitted, but economic rights must be identical)
- No entity shareholders (except certain trusts, estates, and tax-exempt organizations)
- Cannot be a bank, insurance company, or DISC

**Key Issues:**
- Inadvertent termination of S-election: Adding an ineligible shareholder, issuing a second class of stock, exceeding 100 shareholders
- Built-in gains tax: If converting from C-Corp to S-Corp, gain on assets held at conversion is subject to corporate-level tax if sold within 5 years
- Reasonable compensation requirement for shareholder-employees (IRS scrutiny of low salary / high distribution strategies)
- Shareholder agreements must be drafted carefully to avoid creating a "second class of stock"

### LP / LLP

**General Partner (GP) vs Limited Partner (LP):**
- GP has management authority AND unlimited personal liability for partnership obligations
- LP has no management authority (participation in control may destroy liability shield under some state laws) and liability limited to capital contribution
- LLP: All partners have management rights but limited liability (common for professional firms — law, accounting)

**Key Issues:**
- GP personal liability — mitigate by making GP an LLC or corporation
- LP control doctrine: LP participating too actively in management risks losing liability protection (less of an issue under modern uniform acts)
- Transfer restrictions: LP interests are typically not freely transferable; assignment conveys economic rights but not governance rights without GP consent

---

## 3. Equity Structures

### Common vs Preferred Stock

**Common Stock:**
- Standard equity. Voting rights (typically one vote per share). Last in liquidation priority.
- Founders, employees, and advisors typically hold common stock or options to purchase common.

**Preferred Stock (Venture-Backed Companies):**

- **Liquidation Preference**: Amount paid before common stock receives anything in a liquidation event (sale, merger, dissolution). Standard: 1x non-participating (investors get their money back OR convert to common, whichever is greater). Aggressive: 2x-3x participating (investors get 2-3x their money back AND share in remaining proceeds pro rata with common).
- **Participation**: Participating preferred gets liquidation preference PLUS pro-rata share of remaining proceeds. Non-participating preferred chooses one or the other (converts to common if upside exceeds preference). Participating preferred with a cap is a middle ground.
- **Anti-Dilution Protection**: Protects against down-rounds. **Broad-based weighted average** is market standard (adjusts conversion price based on weighted average of new and old prices). **Full ratchet** is investor-aggressive (conversion price drops to the new lower price regardless of amount raised — can be devastating to founders).
- **Conversion Rights**: Preferred converts to common at a ratio (initially 1:1, adjusted by anti-dilution). Voluntary conversion at holder's option. Mandatory/automatic conversion upon IPO (typically at a specified minimum price and offering size).
- **Dividend Rights**: Cumulative vs non-cumulative. Standard in VC: non-cumulative, accruing only when declared. Cumulative dividends increase liquidation preference over time — flag as aggressive.

### Option Pools

- **Standard Size**: 10-20% of fully diluted shares at time of financing. Typically established or refreshed at each funding round.
- **Refresh Mechanics**: New shares added to the pool, usually from pre-money valuation (dilutes existing stockholders, including founders, before new investors).
- **Exercise Mechanics**: Employee pays exercise price (strike price) to purchase shares. ISO vs NSO tax implications. Early exercise permitted? (Beneficial for employees to start capital gains clock.)
- **409A Valuation**: IRS requires stock options be granted at fair market value. Independent 409A appraisal required (typically annually or after material events). Granting below FMV = Section 409A penalties (20% excise tax + interest on employee).

### Vesting Schedules

- **Standard**: 4-year vesting with 1-year cliff. 25% vests at 1-year anniversary, then 1/48th monthly (or 1/16th quarterly) thereafter.
- **Cliff**: No vesting until cliff date. If terminated before cliff, no equity. Protects company from short-tenure employees walking away with equity.
- **Acceleration Triggers**:
  - **Single Trigger**: Equity accelerates upon a change of control event alone. More favorable to employee. Common for executives.
  - **Double Trigger**: Equity accelerates only upon change of control PLUS termination without cause or resignation for good reason within a specified period (typically 12 months). More favorable to acquirer (employees must stay). Market standard for VC-backed companies.

### SAFE Notes and Convertible Notes

**SAFE (Simple Agreement for Future Equity):**
- Y Combinator standard form. Not a debt instrument — no maturity date, no interest.
- Converts to equity at next priced round at a discount or valuation cap, whichever is more favorable to the investor.
- **Valuation Cap**: Maximum effective valuation at which the SAFE converts. If company's valuation at next round exceeds the cap, SAFE holder converts at the cap (getting more shares per dollar).
- **Discount**: Percentage discount to the price paid by new investors (typically 15-25%).
- **MFN (Most Favored Nation)**: If company issues subsequent SAFEs with better terms, earlier SAFE holders can adopt those terms.
- **Pro Rata Rights**: Right to participate in future rounds to maintain ownership percentage. Standard in SAFE side letters.

**Convertible Notes:**
- Debt instrument that converts to equity. Has maturity date and interest rate.
- Conversion mechanics similar to SAFE (cap and/or discount).
- If not converted by maturity: company must repay principal + interest, or renegotiate. Creates potential crisis if no equity round occurs.
- Interest accrues and converts alongside principal (increases shares received at conversion).
- Qualified Financing threshold: Minimum amount of the equity round that triggers automatic conversion (typically $1M+).

### Other Equity Types

- **Restricted Stock**: Actual shares issued subject to vesting and repurchase right. Requires 83(b) election within 30 days to avoid unfavorable tax treatment. Common for founders.
- **RSUs (Restricted Stock Units)**: Promise to deliver shares upon vesting. No property received until vesting — no 83(b) election needed or available. Taxed as ordinary income at vesting. Common for later-stage/public companies.
- **Phantom Equity**: Contractual right to cash payment equal to value of a specified number of shares. No actual equity issued. Useful for non-US employees or when issuing equity is impractical. Subject to 409A.
- **Profits Interests**: LLC equivalent of stock options. Entitles holder to share in future appreciation above a specified threshold. Typically taxed as capital gains if structured properly (no 409A issues). Must set the "hurdle" or "participation threshold" at current fair market value.

---

## 4. Control & Power Provisions

### Protective Provisions (Investor Veto Rights)

Standard protective provisions requiring preferred stockholder approval:
- Amending the charter or bylaws in a way that adversely affects the preferred stock
- Issuing equity senior to or pari passu with existing preferred stock
- Increasing or decreasing authorized shares of preferred stock
- Declaring or paying dividends
- Redeeming or repurchasing shares (other than at cost upon termination)
- Incurring debt above a specified threshold
- Changing the size of the board
- Liquidating, dissolving, or winding down the company
- Consummating a merger, sale, or change of control transaction

**Analysis points**: How many of these require consent? From which series? Investor-friendly agreements have extensive protective provisions; founder-friendly agreements limit them to truly fundamental changes. Each protective provision is effectively a veto right.

### Board Seat Rights and Observer Rights

- **Board seats**: Investor right to designate one or more board members. Typically tied to ownership threshold (lost if ownership drops below a specified percentage).
- **Observer rights**: Right to attend board meetings in a non-voting capacity. Receive all materials distributed to directors. Can be excluded from discussions where a conflict exists or attorney-client privilege applies.
- **Board composition formula**: Common example — "Board shall consist of 5 members: 2 designated by common stockholders, 2 designated by preferred stockholders, 1 independent mutually agreed."

### Drag-Along and Tag-Along Rights

**Drag-Along:**
- Majority stockholders (or specified percentage) can force all stockholders to participate in an approved sale transaction
- Prevents minority holdouts from blocking an exit
- Typical threshold: Majority of common + majority of preferred (voting together or separately)
- Stockholders must vote in favor, tender shares, and not exercise appraisal rights
- Should include price floor or fairness protections (same price per share as dragging stockholders)

**Tag-Along (Co-Sale):**
- If a major stockholder sells shares, minority holders can participate pro rata on the same terms
- Prevents founders from cashing out while investors are left behind
- Typically applies to transfers by founders/key holders, not transfers by investors
- Does not apply to certain exempt transfers (estate planning, affiliates)

### ROFR (Right of First Refusal) and Co-Sale

- **ROFR**: Company (or investors) have the right to purchase shares that a stockholder wishes to sell before the sale to a third party can proceed
- **Mechanics**: Selling stockholder provides transfer notice with proposed terms. ROFR holders have specified period (typically 15-30 days) to elect to purchase on same terms. If ROFR not exercised, co-sale rights kick in. If co-sale not exercised, seller can proceed with third-party sale on terms no more favorable than proposed.
- **Waiver**: Board can waive ROFR for secondary sales (common in later-stage companies to provide liquidity).

### Information Rights and Inspection Rights

- **Contractual information rights (investors)**: Annual audited financials, quarterly unaudited financials, annual budget/business plan, monthly management reports. Typically granted to "major investors" (holding above a specified threshold).
- **Statutory inspection rights**: DGCL 220 — stockholders can inspect books and records for a proper purpose. Does not require a minimum ownership threshold. Proper purpose: investigating mismanagement, valuing shares, communicating with other stockholders.

---

## 5. Termination Cascades

### How Employment Termination Affects Equity

**Vested Options:**
- Remain exercisable for a post-termination exercise period
- Standard: 90 days post-termination for voluntary resignation or termination without cause
- Termination for cause: Immediate forfeiture of all options (vested and unvested) is common
- ISOs must be exercised within 90 days to maintain ISO tax treatment (regardless of contractual exercise period)

**Unvested Options/Restricted Stock:**
- Unvested equity is forfeited upon termination (unless acceleration applies)
- Company repurchase right on unvested restricted stock at lower of cost or FMV

**Acceleration Scenarios:**
- Single trigger: All or portion accelerates upon change of control
- Double trigger: Accelerates upon change of control + qualifying termination
- Good leaver / bad leaver: Termination without cause or resignation for good reason = good leaver (favorable treatment); termination for cause = bad leaver (forfeiture or repurchase at cost)

### Cause vs Without Cause vs Good Reason

**Cause (Typical Definition):**
- Commission of a felony or crime involving moral turpitude
- Fraud, embezzlement, or misappropriation of company assets
- Willful misconduct or gross negligence in performance of duties
- Material breach of employment agreement (after written notice and cure period, typically 30 days)
- Willful failure to follow lawful directives of the board
- **Key negotiation points**: Require written notice, cure opportunity, board vote (not just CEO determination), "willful" qualifier (not mere negligence)

**Without Cause:**
- Termination for any reason other than cause. Company's unilateral right.
- Typically triggers severance obligations and acceleration provisions

**Good Reason (Constructive Termination):**
- Material reduction in base salary (typically more than 10%)
- Material diminution in duties, authority, or responsibilities
- Required relocation beyond specified distance (typically 25-50 miles)
- Material breach of employment agreement by the company
- Change in reporting structure (e.g., no longer reporting to CEO/board)
- **Key negotiation points**: Must provide written notice within specified period (30-90 days), company gets cure period (30 days), resignation must occur within specified period after cure failure

### Change of Control Provisions

**Definition of Change of Control (typical):**
- Acquisition of more than 50% of outstanding voting stock
- Sale of all or substantially all assets
- Merger or consolidation where existing stockholders hold less than 50% of surviving entity
- Contested election resulting in incumbent board members constituting less than a majority

**Golden Parachutes (280G):**
- Payments contingent on change of control that exceed 3x base amount (5-year average W-2 compensation) trigger 20% excise tax on the "excess parachute payment"
- Company loses tax deduction for the excess amount
- Contractual provisions: "best net" (employee receives whichever is greater — full payment with excise tax, or reduced payment to avoid excise tax) vs "gross-up" (company pays excise tax — very expensive, now rare)

### Clawback Provisions

- Recovery of compensation already paid based on subsequent events
- Common triggers: Financial restatement, misconduct discovered post-termination, breach of restrictive covenants
- SEC Rule 10D-1 (Dodd-Frank): Mandatory clawback of incentive compensation from current and former executives upon financial restatement
- Contractual clawbacks: Broader than statutory — can cover any compensation, not just incentive comp

---

## 6. M&A Key Issues

### Transaction Structures

**Asset Purchase:**
- Buyer acquires specific assets and assumes specific liabilities
- Seller retains entity and any excluded liabilities
- Buyer can cherry-pick assets; seller bears residual liability risk
- Requires assignment of contracts, permits, licenses (may need third-party consent)
- Generally less favorable tax treatment for seller (ordinary income on certain assets)
- Avoids successor liability (except for certain statutory exceptions)

**Stock Purchase:**
- Buyer acquires 100% of equity from stockholders
- Entity continues to exist with all assets AND all liabilities
- Simpler execution — no asset-by-asset transfer
- Buyer inherits all known and unknown liabilities (hence heavier diligence)
- Generally more favorable tax treatment for seller (capital gains)
- No third-party consent needed for contracts (unless change of control triggers exist)

**Merger:**
- Target merges into buyer (or a subsidiary) by operation of law
- All assets and liabilities transfer automatically
- Requires stockholder vote (typically majority of outstanding shares)
- Squeeze-out merger (short-form): If buyer owns 90%+ of target, can merge without stockholder vote of remaining minority (DGCL 253)
- Triangular mergers: Forward (target merges into buyer's sub) or reverse (buyer's sub merges into target — target survives, useful for preserving contracts/licenses)

### Representations and Warranties

**Seller's Reps (key ones):**
- Organization and authority (validly existing, power to enter transaction)
- Capitalization (accurate cap table, no undisclosed equity)
- Financial statements (prepared in accordance with GAAP, fairly present financial condition)
- No undisclosed liabilities
- Compliance with laws
- Material contracts (complete list, no defaults)
- IP ownership and non-infringement
- Tax compliance
- Employee matters (benefits, labor issues)
- Litigation (pending and threatened)
- Environmental compliance

**Qualifiers to watch:**
- "To the knowledge of the Company" — limits to actual awareness (sometimes constructive knowledge after reasonable inquiry)
- "Material" or "Material Adverse Effect" — narrows scope significantly
- "Except as set forth in the disclosure schedules" — exceptions that can swallow the rule
- Sandbagging provision: Does buyer's knowledge of a breach before closing affect post-closing indemnification rights? (Pro-sandbagging clause preserves buyer's rights regardless of pre-closing knowledge)

### Indemnification in M&A

- **Basket/Deductible**: Threshold before indemnification kicks in. "Tipping basket" (once threshold is met, all losses are recoverable from dollar one) vs "true deductible" (only losses above the threshold are recoverable). Typical: 0.5%-1% of deal value.
- **Cap**: Maximum indemnification exposure. Typical: 10-20% of deal value for general reps. Fundamental reps (capitalization, authority, taxes) often uncapped or capped at full purchase price.
- **Escrow**: Portion of purchase price held by third-party escrow agent to secure indemnification obligations. Typical: 5-15% of deal value. Escrow period: 12-18 months. Release mechanics (scheduled or at end of period, less pending claims).
- **Survival Period**: How long reps and warranties survive closing. General reps: 12-18 months. Fundamental reps: 3-6 years or statute of limitations. Tax reps: statute of limitations plus 60 days. Covenants: per their terms.
- **Exclusive Remedy**: Indemnification is typically the sole post-closing remedy (except for fraud). Prevents tort claims, rescission, or other remedies.

### Material Adverse Effect (MAE)

**Typical Definition:**
- Any event, change, or condition that has had, or would reasonably be expected to have, a material adverse effect on the business, operations, results of operations, or financial condition of the Company

**Standard Carve-Outs (events that do NOT constitute a MAE):**
- General economic or market conditions
- Changes in the industry generally (not disproportionately affecting the Company)
- Changes in law or accounting standards
- Natural disasters, pandemics, acts of terrorism, war
- Changes resulting from the announcement of the transaction itself
- Changes resulting from actions taken at buyer's request or with buyer's consent
- Failure to meet financial projections (though the underlying cause may constitute a MAE)

**Analysis points**: The MAE definition is one of the most heavily negotiated provisions in M&A. It determines whether the buyer can walk away between signing and closing. The carve-outs effectively determine who bears the risk of intervening events. Disproportionate impact qualifiers ("except to the extent disproportionately affecting the Company relative to other companies in its industry") are critical — they let the buyer invoke macro events if the target is hit harder than peers.

### Post-Closing Adjustments

**Working Capital Adjustment:**
- Purchase price adjusted based on actual working capital at closing vs a target/peg
- Prevents seller from "raiding" working capital between signing and closing
- Mechanics: Estimated at closing, true-up within 60-90 days based on actual closing date balance sheet
- Disputes resolved by independent accountant (binding, non-appealable)

**Earnout:**
- Additional purchase price contingent on post-closing performance (revenue, EBITDA, milestones)
- Aligns seller and buyer incentives when there is a valuation gap
- Highly contentious — disputes over how the business is operated post-closing, accounting methodology, what counts toward the metric
- Key protections for seller: Covenant to operate the business in ordinary course, access to financial records, dispute resolution mechanism, acceleration on change of control or breach

---

## 7. Delaware Law Specifics

### Key DGCL Sections

**Section 102 — Certificate of Incorporation Contents:**
- 102(a): Required provisions (name, purpose, authorized shares, registered agent)
- 102(b)(1): Broad corporate purpose permitted ("any lawful act or activity")
- **102(b)(7)**: Permits exculpation of directors (and as of 2022, officers) from personal liability for breach of duty of care. Does NOT exculpate for breach of duty of loyalty, bad faith, or intentional misconduct. Every Delaware charter should include this provision.

**Section 141 — Board of Directors:**
- 141(a): Business managed by or under the direction of the board
- 141(b): Board composition, quorum requirements (majority is default)
- 141(c): Committees — board can delegate authority to committees (except certain fundamental actions)
- 141(e): Directors entitled to rely in good faith on reports of officers, accountants, legal counsel
- **141(f)**: Board action by unanimous written consent (without a meeting)
- 141(k): Removal of directors — with or without cause if board is not classified; only for cause if board is classified

**Section 144 — Interested Director Transactions:**
- Self-dealing transaction is not voidable solely because of the director's interest if:
  - (1) Material facts disclosed and transaction approved by disinterested directors, OR
  - (2) Material facts disclosed and transaction approved by stockholders in good faith, OR
  - (3) Transaction is fair to the corporation at the time it is authorized
- Safe harbor — proper process shifts judicial review from entire fairness to business judgment

**Section 220 — Books and Records Inspection:**
- Any stockholder (regardless of ownership percentage) may demand inspection
- Must state a proper purpose (reasonably related to stockholder's interest as stockholder)
- Examples of proper purpose: Investigating mismanagement, valuing shares, identifying other stockholders for communication, evaluating a transaction
- Company can resist if purpose is improper (harassment, competitive intelligence, etc.)
- Powerful pre-litigation tool — often used before filing derivative suits
- Court can order inspection and award attorneys' fees to successful stockholder

**Section 242 — Charter Amendments:**
- Requires board resolution recommending the amendment + stockholder approval (majority of outstanding shares entitled to vote)
- Class vote required if amendment would: increase/decrease authorized shares of a class, change par value, alter preferences or rights of a class, create shares with superior rights
- 242(b)(2): Specific class voting protections

**Section 251 — Mergers:**
- Requires board approval + stockholder approval (majority of outstanding shares)
- 251(f): No stockholder vote required if: (1) charter is not amended, (2) each share of surviving corporation outstanding before merger remains identical after, and (3) new shares issued do not exceed 20% of pre-merger outstanding
- 251(g): Holding company reorganization without stockholder vote
- 251(h): Medium-form merger — after tender offer for majority of shares, merger can close without stockholder vote (facilitates two-step acquisitions)

**Section 253 — Short-Form Merger:**
- Parent owning 90%+ of subsidiary can merge without subsidiary stockholder vote
- 10-day advance notice to minority stockholders required
- Minority stockholders have appraisal rights (Section 262)
- Key tool for squeezing out minority stockholders after a tender offer

**Section 262 — Appraisal Rights:**
- Dissenting stockholders can petition the Court of Chancery for a judicial determination of "fair value" of their shares
- Available in mergers (with exceptions — market-out exception for publicly traded stock with cash/stock of listed company as consideration)
- NOT available in asset sales (even if economically equivalent to a merger)
- Stockholder must: (1) not vote in favor of the merger, (2) make written demand for appraisal before the vote, (3) continuously hold shares through the effective date of the merger, (4) file petition within 120 days
- Court determines fair value — may be higher OR lower than merger consideration
- Interest accrues on the fair value amount from the effective date
- Quasi-appraisal: Court of Chancery can award appraisal-like relief in breach of fiduciary duty cases

**Section 271 — Sale of All or Substantially All Assets:**
- Requires board resolution + stockholder approval (majority of outstanding shares)
- "Substantially all" is fact-specific — generally means assets that are quantitatively vital to the operation of the corporation (not necessarily a percentage test)
- No appraisal rights for asset sales under DGCL (may be available contractually)

### Standards of Judicial Review

**Business Judgment Rule:**
- Default standard for disinterested, informed board decisions
- Highly deferential — plaintiff must prove breach (practically insurmountable)
- Applies to: routine business decisions, arm's-length transactions, decisions by disinterested directors

**Enhanced Scrutiny (Unocal Standard):**
- Applies when the board takes defensive action against a hostile takeover or perceived threat
- Two-part test: (1) Board must show reasonable grounds for believing a danger to corporate policy existed (good faith, reasonable investigation), (2) Defensive measure must be proportionate to the threat posed (not preclusive or coercive)
- Intermediate standard — more searching than business judgment, less than entire fairness

**Revlon Duties:**
- Triggered when the board decides to sell the company or a change of control becomes inevitable
- Board must seek the best price reasonably available for stockholders
- No longer defending the "corporate bastion" — the duty shifts to maximizing immediate stockholder value
- Requires: active market check or post-signing market check (go-shop), reasonable deal protections (termination fee, matching rights), no unreasonable barriers to competing bids
- Typical termination fee: 2-4% of deal value (higher is suspect under Revlon)

**Entire Fairness:**
- Most exacting standard. Applies to self-dealing transactions and controlling stockholder transactions.
- Burden on the defendant to prove: (1) fair dealing (process — timing, initiation, structure, negotiation, disclosure) AND (2) fair price (economic fairness, supported by recognized valuation methods)
- Can shift burden to plaintiff if transaction approved by: independent committee (in good faith, with authority to say no) AND majority-of-the-minority vote (MFW framework)

**Blasius Standard:**
- Applies when the board acts for the primary purpose of impeding stockholder franchise (voting rights)
- "Compelling justification" required — extremely difficult for the board to satisfy
- Example: Board expanding its own size and filling new seats to dilute a dissident stockholder's voting power before an election

### Key Delaware Doctrines

**Corwin Doctrine (Corwin v. KKR):**
- Fully informed, uncoerced vote of a majority of disinterested stockholders approving a transaction cleanses the transaction for business judgment review, even if Revlon or Unocal would otherwise apply
- Extremely powerful — effectively makes stockholder-approved transactions unassailable except for waste
- Does NOT apply to controlling stockholder transactions

**MFW Framework (Kahn v. M&F Worldwide):**
- Controlling stockholder squeeze-out merger reviewed under business judgment (rather than entire fairness) if BOTH conditions are met ab initio (from the outset):
  - (1) Conditioned on approval of an independent, fully empowered special committee, AND
  - (2) Conditioned on majority-of-the-minority stockholder vote
- Both conditions must be imposed before substantive negotiations begin — cannot be added later as a "fix"

**Schnell Doctrine:**
- "Inequitable action does not become permissible simply because it is legally possible"
- Courts will intervene when fiduciaries use technically legal corporate machinery for inequitable purposes
- Example: Board advancing the annual meeting date to prevent a stockholder activist from conducting a proxy fight

---

## Usage Notes for the Senior Associate Agent

When analyzing a corporate governance matter:
1. Identify the entity type and jurisdiction first — this determines which legal framework applies.
2. Review the governing documents (charter, bylaws, operating agreement) before making any governance determination.
3. For equity analysis, build or verify the capitalization table — determine fully diluted ownership including all options, warrants, convertibles, and SAFEs.
4. For control analysis, map voting rights, protective provisions, board composition, and consent rights to determine who actually controls decisions.
5. For M&A matters, identify the transaction structure, applicable standard of review, and fiduciary duty framework.
6. For Delaware law matters, cite specific DGCL sections and leading cases.
7. Always note when an issue requires jurisdiction-specific analysis beyond Delaware (e.g., state employment law for restrictive covenants, securities law for equity issuances).
8. Produce output with: Entity Summary, Governance Analysis, Equity/Capitalization Analysis, Control Map, Risk Identification, and Recommendations.
