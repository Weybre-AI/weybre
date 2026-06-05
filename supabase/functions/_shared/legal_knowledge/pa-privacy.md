# Privacy Law Reference — Weybre AI

Comprehensive privacy law knowledge base for the Privacy/Data Protection Specialist agent.

---

## 1. CCPA/CPRA (California Consumer Privacy Act / California Privacy Rights Act)

### Applicability Thresholds (any one of)
- Annual gross revenue exceeding $25 million (adjusted for inflation by CPPA)
- Buys, sells, or shares personal information of 100,000+ consumers or households
- Derives 50%+ of annual revenue from selling or sharing consumers' personal information

### Consumer Rights
| Right | Description | Response Deadline |
|-------|-------------|-------------------|
| Right to Know | Categories and specific pieces of PI collected | 45 days (+ 45-day extension) |
| Right to Delete | Request deletion of PI collected from consumer | 45 days (+ 45-day extension) |
| Right to Correct | Correct inaccurate PI | 45 days (+ 45-day extension) |
| Right to Opt-Out of Sale/Sharing | Stop sale or sharing of PI for cross-context behavioral advertising | Implement within 15 business days |
| Right to Limit Use of SPI | Restrict use of sensitive PI to what is necessary | 15 business days |
| Right to Non-Discrimination | Cannot deny goods/services or charge different prices for exercising rights | Ongoing obligation |
| Right to Data Portability | Receive PI in portable, readily usable format | 45 days |

### Sensitive Personal Information (SPI) Categories
- SSN, driver's license, state ID, passport number
- Account log-in with password or security credentials
- Precise geolocation (within 1,850 feet)
- Racial or ethnic origin, religious beliefs, union membership
- Contents of mail, email, or text messages (unless business is intended recipient)
- Genetic data, biometric data for identification
- Health information, sex life, or sexual orientation

### Business Obligations
- **Notice at Collection**: Disclose categories of PI collected, purposes, whether sold/shared, retention periods
- **Privacy Policy**: Updated at least every 12 months; must list categories collected, purposes, consumer rights, opt-out methods
- **"Do Not Sell or Share My Personal Information"** link: Required on homepage
- **Data Processing Agreements**: Required with service providers and contractors
- **Data minimization**: Collect only PI reasonably necessary and proportionate to disclosed purposes
- **Storage limitation**: Retain PI only as long as reasonably necessary for disclosed purposes

### Entity Distinctions
| Category | Definition | Obligations |
|----------|-----------|-------------|
| Business | Entity meeting applicability thresholds that determines purposes/means of processing | Full CCPA compliance |
| Service Provider | Processes PI on behalf of a business under written contract | Limited use, must assist with consumer requests, cannot sell/share |
| Contractor | Similar to service provider, additional certification requirements under CPRA | Contractual restrictions, certification, audit rights |
| Third Party | Entity that is not the business, service provider, or contractor | Receives PI through sale or sharing; subject to consumer opt-out |

### Enforcement
- **CPPA (California Privacy Protection Agency)**: Primary enforcement body (established by CPRA)
- **California AG**: Concurrent enforcement authority
- **Administrative fines**: Up to $2,500 per violation; $7,500 per intentional violation or violation involving minors
- **Private right of action**: Limited to data breaches only (Cal. Civ. Code 1798.150) — statutory damages $100-$750 per consumer per incident, or actual damages if greater
- **30-day cure period**: Eliminated by CPRA for AG enforcement; CPPA has discretion

### Key Exemptions
- **Employee/HR data**: Partially exempt (basic rights apply, full exemption expired Jan 1, 2023)
- **B2B communications**: Partially exempt (similar to employee data)
- **HIPAA-covered data**: Exempt when governed by HIPAA Privacy Rule
- **GLBA-covered data**: Exempt when subject to Gramm-Leach-Bliley Act
- **Fair Credit Reporting Act data**: Exempt when subject to FCRA
- **Clinical trial data**: Exempt under specified conditions

---

## 2. Comprehensive State Privacy Laws (2024-2026)

### State-by-State Summary

**Virginia CDPA** (effective Jan 1, 2023)
- Thresholds: Control/process PI of 100K+ consumers OR 25K+ consumers and derive 50%+ revenue from sale
- Rights: Access, correction, deletion, portability, opt-out of sale/targeted advertising/profiling
- No private right of action; AG enforcement only
- Data protection assessments required for targeted advertising, sale, profiling, SPI processing

**Colorado CPA** (effective Jul 1, 2023)
- Thresholds: 100K+ consumers OR 25K+ consumers and derive revenue from sale
- Universal opt-out mechanism required (effective Jul 1, 2024)
- Rights: Access, correction, deletion, portability, opt-out of sale/targeted advertising/profiling
- AG and DA enforcement; 60-day cure period (sunsets Jan 1, 2025)

**Connecticut CTDPA** (effective Jul 1, 2023)
- Thresholds: Same as Colorado
- Includes nonprofit organizations (unlike most state laws)
- Recognizes universal opt-out signals
- Rights: Access, correction, deletion, portability, opt-out
- AG enforcement; 60-day cure period (sunsets Dec 31, 2024)

**Utah UCPA** (effective Dec 31, 2023)
- Thresholds: $25M annual revenue AND (100K+ consumers OR 50%+ revenue from sale)
- Most business-friendly; narrower scope; no data protection assessment requirement
- No right to correction; opt-out of sale and targeted advertising only
- AG enforcement; 30-day cure period (no sunset)

**Texas TDPSA** (effective Jul 1, 2024)
- No revenue threshold — applies to any entity conducting business in Texas that processes PI and is not a small business under SBA standards
- Broadest applicability of any state law
- Rights: Access, correction, deletion, portability, opt-out
- AG enforcement; 30-day cure period

**Oregon OCPA** (effective Jul 1, 2024)
- Covers nonprofit organizations
- Narrow exemptions (does not exempt all HIPAA-covered entities, only HIPAA-covered data)
- Rights: Access, correction, deletion, portability, opt-out, list of third parties
- AG enforcement; 30-day cure period (sunsets Jan 1, 2026)

**Montana MCDPA** (effective Oct 1, 2024) — 50K+ consumers (smaller population); standard rights
**Delaware DPDPA** (effective Jan 1, 2025) — 35K+ consumers threshold; covers nonprofits
**Iowa ICDPA** (effective Jan 1, 2025) — Narrow; opt-out of sale and targeted advertising only; 90-day cure
**Tennessee TIPA** (effective Jul 1, 2025) — 175K+ consumers; affirmative defense for NIST compliance
**Indiana ICDPA** (effective Jan 1, 2026) — 100K+ consumers; standard framework
**Florida FDBR** (effective Jul 1, 2024) — $1B+ global revenue threshold; narrower scope; children's protections

**Washington My Health My Data Act** (effective Mar 31, 2024)
- Covers "consumer health data" NOT governed by HIPAA — very broad definition
- Applies to any entity conducting business in Washington or targeting Washington consumers
- **Geofencing prohibition**: Cannot geofence within 2,000 feet of health care facilities to collect health data
- **Private right of action**: Under Washington CPA — significant litigation risk
- Requires separate consent for collection and sharing of health data
- Applies regardless of company size

### State Comparison Matrix

| State | Effective | Threshold | Right to Correct | Universal Opt-Out | Private Right of Action | Cure Period |
|-------|-----------|-----------|-----------------|-------------------|------------------------|-------------|
| CA (CPRA) | Jan 2023 | $25M/100K/50% | Yes | Yes (GPC) | Breach only | Discretionary |
| VA | Jan 2023 | 100K/25K+50% | Yes | No | No | 30 days |
| CO | Jul 2023 | 100K/25K+rev | Yes | Required | No | 60 days (sunset) |
| CT | Jul 2023 | 100K/25K+rev | Yes | Required | No | 60 days (sunset) |
| UT | Dec 2023 | $25M+100K/50% | No | No | No | 30 days |
| TX | Jul 2024 | No revenue req | Yes | Yes | No | 30 days |
| OR | Jul 2024 | 100K/25K+rev | Yes | Yes | No | 30 days (sunset) |
| WA Health | Mar 2024 | None | N/A | N/A | Yes (CPA) | None |
| FL | Jul 2024 | $1B+ | Yes | No | No | 45 days |
| DE | Jan 2025 | 35K | Yes | Yes | No | 60 days |

---

## 3. GDPR Essentials

### Lawful Bases for Processing (Article 6)
1. **Consent** — freely given, specific, informed, unambiguous; withdrawable at any time
2. **Contract** — necessary for performance of a contract with the data subject
3. **Legal obligation** — necessary to comply with EU/member state law
4. **Vital interests** — protect life of data subject or another person
5. **Public task** — necessary for task in the public interest or official authority
6. **Legitimate interest** — pursued by controller or third party, balanced against data subject rights (requires LIA)

### Data Subject Rights
| Right | Article | Key Requirements |
|-------|---------|-----------------|
| Information/Access | 13-15 | Respond within 1 month; free first copy |
| Rectification | 16 | Without undue delay |
| Erasure ("Right to be Forgotten") | 17 | When consent withdrawn, no longer necessary, unlawful processing |
| Restriction of Processing | 18 | During accuracy disputes or pending objection assessment |
| Data Portability | 20 | Machine-readable format; only for consent/contract-based processing |
| Object | 21 | Absolute for direct marketing; balancing test for legitimate interest |
| Automated Decision-Making | 22 | Right not to be subject to solely automated decisions with legal/significant effects |

### Data Protection Impact Assessment (DPIA) — Article 35
Required when processing is likely to result in high risk, including:
- Systematic and extensive profiling with significant effects
- Large-scale processing of special category data or criminal data
- Systematic monitoring of publicly accessible areas at large scale

### International Data Transfers
- **Adequacy decisions**: EU Commission determines adequate countries (includes UK, Japan, South Korea, Canada for commercial, Argentina, Israel, Switzerland, New Zealand, Uruguay; US under EU-US Data Privacy Framework)
- **Standard Contractual Clauses (SCCs)**: Must conduct Transfer Impact Assessment (TIA)
- **Binding Corporate Rules (BCRs)**: For intra-group transfers; requires DPA approval
- **Derogations**: Explicit consent, contract necessity, public interest, legal claims, vital interests

### Penalties
- **Tier 1**: Up to EUR 10M or 2% worldwide annual turnover (e.g., failure to maintain records, no DPO)
- **Tier 2**: Up to EUR 20M or 4% worldwide annual turnover (e.g., violating processing principles, data subject rights, transfer rules)

### Breach Notification
- **To supervisory authority**: Within 72 hours of becoming aware (unless unlikely to result in risk)
- **To data subjects**: Without undue delay when breach likely to result in high risk to rights and freedoms

---

## 4. Data Processing Agreements (DPAs)

### Required Provisions (GDPR Art. 28 / CCPA)
- Subject matter and duration of processing
- Nature and purpose of processing
- Types of personal data and categories of data subjects
- Obligations and rights of the controller/business
- Processor/service provider must: process only on documented instructions, ensure confidentiality, implement appropriate security measures, assist with data subject/consumer requests
- Sub-processor requirements (prior authorization, flow-down obligations)
- Audit rights for the controller/business
- Deletion or return of data upon termination
- Breach notification provisions and timelines

### CCPA-Specific Requirements
- Service provider must not sell or share PI
- Must not retain, use, or disclose PI outside the direct business relationship
- Must certify understanding of restrictions
- Must notify business if it can no longer meet obligations
- Business must conduct due diligence on service provider's privacy practices

### Sub-Processor Management
- General or specific prior written authorization from controller
- Flow-down of all data protection obligations
- Processor remains liable for sub-processor compliance
- Notification of intended changes to sub-processors; right to object

---

## 5. Privacy Policy Requirements

### Minimum Disclosures
- Categories of PI collected in preceding 12 months
- Sources of PI
- Business or commercial purposes for collection, use, sale, or sharing
- Categories of third parties to whom PI is disclosed
- Specific pieces of PI collected (upon verified request)
- Consumer/data subject rights and how to exercise them
- Contact information (email, phone, physical address for GDPR)
- Effective date and change notification procedures
- "Do Not Sell or Share" link (CCPA)
- Retention periods (GDPR, CPRA)
- Automated decision-making information (GDPR)
- International transfer mechanisms (GDPR)

---

## 6. Cookie Consent and Tracking

### US Approach
- No general federal cookie consent law
- CCPA/state laws: Opt-out required if cookies enable "sale" or "sharing" of PI
- Global Privacy Control (GPC): Legally recognized as opt-out signal in California, Colorado, Connecticut, Texas, Oregon, Montana, Delaware
- No prior consent required for analytics or functional cookies under US law

### GDPR/ePrivacy Approach
- Prior opt-in consent required for all non-essential cookies (CJEU Planet49 decision)
- Essential/strictly necessary cookies exempt (authentication, security, load balancing)
- Consent must be freely given — no cookie walls (with limited exceptions)
- Granular consent by purpose required
- Record of consent must be maintained

---

## 7. Data Breach Response

### State Notification Timeline Matrix
| Timeline | States |
|----------|--------|
| 24 hours | None currently at state level |
| 30 days | Colorado, Florida (to individuals) |
| 45 days | California (to individuals), Ohio, Virginia, Washington |
| 60 days | Connecticut, Delaware, Maine, Maryland, Massachusetts, Oregon, Texas, Vermont |
| Most expedient / without unreasonable delay | Alabama, Alaska, Arizona, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Carolina, North Dakota, Oklahoma, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Utah, West Virginia, Wisconsin, Wyoming |

### Content Requirements (typical)
- Description of the incident (date, nature of breach)
- Types of PI involved
- Steps taken to address the breach
- Contact information for questions
- Steps consumers can take to protect themselves
- Information about identity theft protection services (if offered)

### AG Notification Thresholds
- Many states require AG notification if breach affects 500+ or 1,000+ residents
- California: AG notification if 500+ residents affected
- New York: AG, DFS, and DOS notification for any number
- Texas: AG notification if 250+ residents affected

### Documentation Requirements
- Maintain breach log with: date discovered, date of breach, nature, PI involved, number affected, response taken, notifications sent
- Retain records for minimum 5 years (best practice; some states specify)

---

## 8. Children's Privacy

### COPPA (Children's Online Privacy Protection Act)
- Applies to: Operators of websites/online services directed to children under 13, or with actual knowledge of collecting PI from children under 13
- **Verifiable Parental Consent (VPC)** required before collecting PI from children under 13
- Must post a clear, comprehensive privacy policy describing children's information practices
- FTC enforcement; penalties up to $50,120 per violation (2024 adjusted)
- Safe Harbor programs: CARU, ESRB, iKeepSafe, kidSAFE, Aristotle, PRIVO, TrustArc

### State Extensions
- **California AADC (Age-Appropriate Design Code)**: Applies to services likely to be accessed by children under 18; requires DPIA for children's data; default high privacy settings; prohibits profiling by default
- **Numerous states**: Extending protections to under-16 or under-18 for opt-in consent to sale of PI (California, Connecticut, Colorado, Virginia, Texas, Oregon, Delaware, Montana)

### Age Verification
- Neutral age estimation methods (age gates, date of birth entry)
- Age assurance technologies (facial estimation, ID verification)
- Balance between verification accuracy and data minimization

---

## 9. Biometric Data Laws

### Illinois BIPA (Biometric Information Privacy Act)
- Private right of action — most litigated biometric law in the US
- Damages: $1,000 per negligent violation, $5,000 per intentional/reckless violation
- Per-scan accrual confirmed by Illinois Supreme Court (Cothron v. White Castle, 2023)
- Requires: written policy, informed consent, purpose limitation, retention schedule, data protection
- 5-year statute of limitations

### Texas CUBI (Capture or Use of Biometric Identifier Act)
- AG enforcement only (no private right of action)
- $25,000 per violation
- Covers capture, use, possession, and storage of biometric identifiers

### Washington Biometric Law (RCW 19.375)
- Notice and consent required before enrollment in biometric database
- No private right of action (AG enforcement)
- Commercial purpose restriction

### NYC Biometric Ordinance (Local Law 3)
- Applies to commercial establishments
- Requires signage, prohibition on sale/sharing
- Private right of action: $500 per negligent violation, $5,000 per intentional violation

---

## 10. Privacy Review Checklist

### Data Mapping
- [ ] What PI is collected (categories and specific elements)?
- [ ] From whom (consumers, employees, B2B contacts, children)?
- [ ] For what purposes?
- [ ] How is PI collected (directly, third parties, tracking)?
- [ ] With whom is PI shared/sold (service providers, contractors, third parties)?
- [ ] How long is PI retained?
- [ ] Where is PI stored (jurisdictions)?

### Legal Basis Analysis
- [ ] Identify applicable laws by jurisdiction (where consumers are, where company operates)
- [ ] Determine lawful basis for each processing activity (GDPR)
- [ ] Assess whether "sale" or "sharing" occurs (CCPA/state laws)
- [ ] Evaluate SPI processing and whether restrictions apply

### Rights Mechanism Audit
- [ ] Consumer request intake process (web form, email, phone)
- [ ] Identity verification procedures
- [ ] Response timeline tracking (45 days CCPA, 1 month GDPR)
- [ ] Authorized agent handling
- [ ] Appeal process (required by many state laws)

### Vendor/DPA Audit
- [ ] All vendors processing PI identified
- [ ] DPAs in place with appropriate provisions
- [ ] Sub-processor inventory maintained
- [ ] Due diligence on vendor security practices
- [ ] Data flow mapping includes vendor transfers

### Cross-Border Transfer Analysis
- [ ] Identify international data flows
- [ ] Determine transfer mechanism (adequacy, SCCs, BCRs, derogations)
- [ ] Conduct Transfer Impact Assessment where required
- [ ] Document supplementary measures if needed

### Breach Preparedness
- [ ] Incident response plan documented and tested
- [ ] Notification templates prepared for each jurisdiction
- [ ] AG contact information on file for applicable states
- [ ] Breach log maintained
- [ ] Cyber insurance coverage reviewed
- [ ] Forensic investigation vendor on retainer or pre-selected

---

*Last updated: 2026-03-29. Laws change frequently; verify current status of pending legislation and rulemaking before relying on specific provisions.*
