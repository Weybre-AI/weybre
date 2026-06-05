# Practice Area Reference: Healthcare Compliance

> Weybre AI — Compliance Counsel Agent Reference
> Scope: HIPAA, HITECH, Stark Law, Anti-Kickback, Telehealth, FDA, State Healthcare Law

---

## 1. HIPAA — Health Insurance Portability and Accountability Act

### 1.1 Privacy Rule (45 CFR Part 160, Part 164 Subparts A & E)

**Covered Entities (CE):** Health plans, healthcare clearinghouses, healthcare providers who transmit health information electronically in connection with HIPAA-standard transactions.

**Business Associates (BA):** Persons or entities that perform functions or activities on behalf of (or provide services to) a CE involving the use or disclosure of PHI. Examples: billing companies, EHR vendors, cloud hosting providers, attorneys, accountants, consultants.

**Protected Health Information (PHI):** Individually identifiable health information held or transmitted by a CE or BA in any form (electronic, paper, oral). The 18 HIPAA identifiers:
1. Names
2. Geographic data smaller than state
3. Dates (except year) related to an individual (birth, admission, discharge, death)
4. Telephone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers and serial numbers
13. Device identifiers and serial numbers
14. Web URLs
15. IP addresses
16. Biometric identifiers
17. Full-face photographs and comparable images
18. Any other unique identifying number, characteristic, or code

**Minimum Necessary Standard:** CEs and BAs must make reasonable efforts to limit PHI use, disclosure, and requests to the minimum necessary to accomplish the intended purpose. Does NOT apply to: disclosures to the individual, treatment purposes, disclosures required by law, disclosures to HHS for enforcement, or uses/disclosures authorized by the individual.

**Individual Rights:**
- **Right of Access** (45 CFR 164.524): Individuals may access their PHI in a designated record set. 30 days to respond (one 30-day extension). Fees limited to reasonable cost-based amounts. Must provide in requested format if readily producible. Denial grounds are limited (psychotherapy notes, information compiled for legal proceedings, certain research, certain correctional/safety situations).
- **Right to Amendment** (45 CFR 164.526): Request to amend PHI in designated record set. 60 days to act (one 30-day extension). May deny if accurate/complete, not created by CE, not part of designated record set, or not available for access.
- **Right to Accounting of Disclosures** (45 CFR 164.528): Covers disclosures for purposes other than TPO, to the individual, pursuant to authorization, for facility directory, to persons involved in care, for national security, or to correctional institutions. 6-year lookback. 60 days to provide (one 30-day extension).
- **Right to Request Restrictions** (45 CFR 164.522): Individuals may request restrictions on uses/disclosures for TPO. CE not required to agree EXCEPT: must agree to restrict disclosure to health plan if individual pays out of pocket in full and disclosure is not required by law.
- **Right to Confidential Communications** (45 CFR 164.522): Request to receive communications by alternative means or at alternative locations. Health plans must accommodate reasonable requests; providers must accommodate.
- **Right to Notice of Privacy Practices** (45 CFR 164.520): Must describe uses/disclosures, individual rights, CE duties. Distributed at first service delivery (direct treatment providers) or upon enrollment (health plans). Must be posted at facility and on website.

**Authorizations vs. Consent:**
- **Authorization** (45 CFR 164.508): Required for uses/disclosures not otherwise permitted (marketing, sale of PHI, psychotherapy notes). Must include: description of PHI, persons authorized to make/receive disclosure, purpose, expiration, right to revoke, signature and date. Must be in plain language. Compound authorizations prohibited for treatment-conditioned authorizations.
- **Consent** (45 CFR 164.506): Optional written consent for TPO. Not required but may be obtained. Distinct from authorization.

**Treatment, Payment, and Operations (TPO) Exceptions:** PHI may be used/disclosed without authorization for:
- **Treatment:** Provision, coordination, or management of healthcare
- **Payment:** Activities related to obtaining reimbursement, billing, claims management, utilization review
- **Healthcare Operations:** Quality assessment, competency assurance, conducting/arranging medical review, business planning, resolution of internal grievances, compliance activities, business management

**De-identification Methods (45 CFR 164.514):**
- **Safe Harbor:** Remove all 18 identifiers; no actual knowledge that residual information could identify individual
- **Expert Determination:** Qualified statistical/scientific expert determines risk of identification is very small; documents methods and results

**Directory Exception:** CE may maintain a facility directory with name, location, general condition (fair/good/critical), religious affiliation. Individual must be informed in advance and given opportunity to restrict/prohibit. In emergencies, may include if consistent with prior expressed preference.

**Research Use:** PHI may be used for research with: (a) individual authorization, (b) IRB/Privacy Board waiver of authorization (must meet criteria), (c) preparatory to research (no PHI removal), (d) research on decedents' information, (e) limited data set with data use agreement.

### 1.2 Security Rule (45 CFR Part 164 Subpart C)

Applies to electronic PHI (ePHI) only. Requires CEs and BAs to ensure confidentiality, integrity, and availability of ePHI.

**Administrative Safeguards (45 CFR 164.308):**
- Security management process (risk analysis, risk management, sanction policy, information system activity review) — REQUIRED
- Assigned security responsibility (designated security official) — REQUIRED
- Workforce security (authorization/supervision, workforce clearance, termination procedures) — ADDRESSABLE
- Information access management (access authorization, access establishment/modification, isolating clearinghouse functions) — mix of REQUIRED and ADDRESSABLE
- Security awareness and training (security reminders, malicious software protection, login monitoring, password management) — ADDRESSABLE
- Security incident procedures (response and reporting) — REQUIRED
- Contingency plan (data backup plan, disaster recovery plan, emergency mode operation plan, testing and revision, applications and data criticality analysis) — mix of REQUIRED and ADDRESSABLE
- Evaluation (periodic technical and nontechnical evaluation) — REQUIRED
- BA contracts and other arrangements — REQUIRED

**Physical Safeguards (45 CFR 164.310):**
- Facility access controls (contingency operations, facility security plan, access control and validation, maintenance records) — ADDRESSABLE
- Workstation use (policies for proper workstation use) — REQUIRED
- Workstation security (physical safeguards restricting access) — REQUIRED
- Device and media controls (disposal, media re-use, accountability, data backup and storage) — mix of REQUIRED and ADDRESSABLE

**Technical Safeguards (45 CFR 164.312):**
- Access controls (unique user identification — REQUIRED; emergency access procedure — REQUIRED; automatic logoff — ADDRESSABLE; encryption and decryption — ADDRESSABLE)
- Audit controls (hardware, software, procedural mechanisms to record/examine activity) — REQUIRED
- Integrity controls (mechanism to authenticate ePHI, protect from improper alteration/destruction) — ADDRESSABLE
- Person or entity authentication — REQUIRED
- Transmission security (integrity controls — ADDRESSABLE; encryption — ADDRESSABLE)

**Addressable vs. Required:**
- REQUIRED: Must be implemented as specified
- ADDRESSABLE: Must assess whether reasonable and appropriate. If yes, implement. If not, document why and implement equivalent alternative measure (or document why no alternative is reasonable and appropriate)

**Encryption Standards:** NIST recommends AES-128 or AES-256 for data at rest; TLS 1.2+ for data in transit. While encryption is addressable, OCR has consistently treated lack of encryption as a significant risk factor in breach investigations.

### 1.3 Breach Notification Rule (45 CFR Part 164 Subpart D)

**Definition of Breach:** Acquisition, access, use, or disclosure of PHI in a manner not permitted by the Privacy Rule that compromises the security or privacy of the PHI. Presumed to be a breach unless the CE/BA demonstrates low probability of compromise via risk assessment.

**4-Factor Risk Assessment:**
1. Nature and extent of PHI involved (types of identifiers, likelihood of re-identification)
2. Unauthorized person who used the PHI or to whom disclosure was made
3. Whether PHI was actually acquired or viewed
4. Extent to which risk to PHI has been mitigated

**Exceptions (NOT a breach):**
1. Unintentional acquisition, access, or use by workforce member acting in good faith, within scope of authority, no further impermissible use/disclosure
2. Inadvertent disclosure between persons authorized to access PHI at same CE/BA, no further impermissible use/disclosure
3. Good faith belief that unauthorized person would not reasonably be able to retain the PHI

**Notification Requirements:**
- **Individual notification:** Without unreasonable delay, no later than 60 calendar days from discovery. Written notice by first-class mail (or email if individual agreed). Must include: description of breach, types of information involved, steps individual should take, what CE is doing, contact information. Substitute notice for insufficient contact info (website posting 90 days, major media if 10+ individuals).
- **HHS notification:** If breach affects 500+ individuals: notify HHS contemporaneously (within 60 days). If fewer than 500: may maintain log and submit annually (within 60 days of end of calendar year).
- **Media notification:** If breach affects 500+ residents of a state/jurisdiction: prominent media outlet in that state/jurisdiction within 60 days.
- **BA obligation:** Notify CE without unreasonable delay, no later than 60 days from discovery. Identify each individual affected.

### 1.4 HIPAA Enforcement

**Civil Monetary Penalty Tiers (per violation):**
| Tier | Knowledge Level | Per Violation | Annual Cap |
|------|----------------|---------------|------------|
| 1 | Did not know / could not have known | $100 - $50,000 | $25,000 |
| 2 | Reasonable cause (not willful neglect) | $1,000 - $50,000 | $100,000 |
| 3 | Willful neglect, corrected within 30 days | $10,000 - $50,000 | $250,000 |
| 4 | Willful neglect, NOT corrected within 30 days | $50,000 | $1,500,000 |

Note: Penalty amounts adjusted for inflation annually. HHS has discretion not to impose penalties if violation is due to reasonable cause and corrected within 30 days.

**Criminal Penalties (DOJ prosecution):**
- Knowingly obtaining/disclosing PHI: up to $50,000 fine and 1 year imprisonment
- Under false pretenses: up to $100,000 fine and 5 years
- With intent to sell, transfer, or use for commercial advantage, personal gain, or malicious harm: up to $250,000 fine and 10 years

**State AG Enforcement:** State attorneys general may bring civil actions on behalf of state residents. Damages of $100 per violation, $25,000 cap per identical violation per calendar year, plus attorney fees.

**OCR Investigation Process:** Complaint filed (180-day deadline) or compliance review initiated -> CE/BA notified -> investigation and document requests -> resolution (technical assistance, voluntary compliance, resolution agreement with corrective action plan and potential monetary settlement, or civil monetary penalty via ALJ hearing).

---

## 2. HITECH Act (Health Information Technology for Economic and Clinical Health)

- Extended HIPAA Security Rule and certain Privacy Rule provisions directly to BAs (previously only contractual obligation)
- Mandated breach notification (created the Breach Notification Rule)
- Increased civil penalties (tiered structure above)
- Prohibited sale of PHI without authorization
- Restricted marketing communications funded by third parties
- Required BA agreements for all BA relationships, including subcontractors ("downstream" BAs)
- Subcontractor chain: BAs must ensure subcontractors agree to same restrictions/conditions; subcontractors are directly liable for HIPAA violations
- Meaningful Use / Promoting Interoperability: incentive program for EHR adoption (now largely transitioned to merit-based incentive payment system / MIPS)

---

## 3. Business Associate Agreements (BAAs)

**Required Provisions Checklist:**
- [ ] Permitted and required uses/disclosures of PHI (limited to terms of agreement, Privacy Rule, minimum necessary)
- [ ] Prohibition on use/disclosure beyond agreement or law
- [ ] Appropriate safeguards to prevent unauthorized use/disclosure
- [ ] Reporting of unauthorized uses/disclosures and security incidents to CE
- [ ] Ensuring subcontractors agree to same restrictions (flow-down)
- [ ] Making PHI available to individuals for access rights
- [ ] Making PHI available for amendment
- [ ] Making information available for accounting of disclosures
- [ ] Making internal practices/records available to HHS
- [ ] Return or destruction of PHI at termination (if feasible; if not, extend protections)
- [ ] Breach notification obligations (timelines, content, cooperation)

**Common Negotiation Points:**
- **Indemnification for breach:** CE typically seeks indemnification for costs arising from BA's breach (notification costs, credit monitoring, regulatory fines, litigation). BA pushes back on unlimited indemnity.
- **Insurance requirements:** CE may require BA to maintain cyber liability insurance (typical: $1M-$5M depending on volume of PHI). Key coverage: breach response, regulatory defense, business interruption.
- **Audit rights:** CE right to audit BA's compliance (typically annually or upon breach). BA may negotiate for notice period, scope limitations, and cost allocation.
- **Security standards:** Specify minimum standards (encryption at rest and in transit, MFA, SOC 2 Type II, HITRUST certification). Going beyond HIPAA minimum is common practice.
- **Breach notification timeline:** HIPAA says 60 days; many CEs negotiate shorter (24-72 hours for suspected incidents, 10-30 days for confirmed breaches).
- **Termination for breach of BAA:** Right to terminate underlying services agreement if BAA is materially breached and not cured within specified period (typically 30 days).
- **Survival:** PHI protection obligations survive termination.

---

## 4. Stark Law (42 USC 1395nn) — Physician Self-Referral

**Prohibition:** Physician (or immediate family member) who has a financial relationship (ownership/investment interest or compensation arrangement) with an entity may NOT make referrals for designated health services (DHS) payable by Medicare to that entity, UNLESS an exception applies.

**Designated Health Services (DHS):**
1. Clinical laboratory services
2. Physical therapy, occupational therapy, outpatient speech-language pathology
3. Radiology and certain other imaging services
4. Radiation therapy services and supplies
5. Durable medical equipment and supplies
6. Parenteral and enteral nutrients, equipment, and supplies
7. Prosthetics, orthotics, and prosthetic devices and supplies
8. Home health services
9. Outpatient prescription drugs
10. Inpatient and outpatient hospital services

**Key Exceptions:**
- **In-office ancillary services** (42 CFR 411.355): Services furnished personally by referring physician, another physician in same group practice, or individual supervised by physician/group practice member; furnished in same building or centralized location; billed by performing/supervising physician or group practice. Must meet all three elements.
- **Physician services** (411.355(a)): Services personally performed by another physician in same group practice
- **Employment** (411.357(c)): Bona fide employment for identifiable services; compensation consistent with fair market value, not determined by volume/value of referrals
- **Personal services arrangements** (411.357(d)): Written agreement, signed by parties, specifying services; term of at least 1 year; compensation set in advance, FMV, not determined by volume/value of referrals
- **Rental of office space/equipment** (411.357(a)/(b)): Written agreement, at least 1 year term, space/equipment specified, rent at FMV, commercially reasonable
- **Isolated transactions** (411.357(f)): One-time transaction, FMV, not determined by volume/value of referrals, commercially reasonable
- **Fair market value compensation** (411.357(l)): Written arrangement, compensation FMV for identifiable services, not determined by volume/value of referrals

**Strict Liability:** No intent requirement. If the arrangement does not fit squarely within an exception, it violates Stark regardless of the parties' intent or knowledge. This is the critical distinction from Anti-Kickback.

**Penalties:**
- Denial of payment / refund of amounts collected
- Civil monetary penalties: up to $15,000 per service + up to 3x the amount claimed
- Exclusion from federal healthcare programs
- False Claims Act liability (treble damages + per-claim penalties of $11,000-$23,000)
- If circumvention scheme: up to $100,000 per arrangement

---

## 5. Anti-Kickback Statute (42 USC 1320a-7b(b))

**Prohibition:** Knowingly and willfully soliciting, receiving, offering, or paying any remuneration (directly or indirectly, overtly or covertly, in cash or in kind) to induce or reward referrals for services covered by a federal healthcare program.

**One Purpose Test:** Under the Affordable Care Act amendment, a violation requires only that ONE purpose of the remuneration is to induce referrals (need not be the primary or sole purpose).

**Key Safe Harbors (42 CFR 1001.952):**
- **Employment** (1001.952(i)): Bona fide employer-employee relationship
- **Personal services and management contracts** (1001.952(d)): Written agreement, specifying services, term of at least 1 year, aggregate compensation set in advance at FMV, not determined by volume/value of referrals
- **Space rental** (1001.952(b)): Written agreement, at least 1 year, rent set in advance at FMV, space specified, commercially reasonable
- **Equipment rental** (1001.952(c)): Same requirements as space rental
- **Sale of practice** (1001.952(e)): Practitioner selling entire practice to buyer; seller does not practice for 1 year post-sale within geographic area
- **Investment interests** (1001.952(a)): Large entity (60-40 tests) or small entity (8 standards including 60-40, no more than 40% investors from referral sources, no marketing to investors, etc.)
- **Discount** (1001.952(h)): Reduction in price properly disclosed and accurately reported
- **Group purchasing organizations** (1001.952(j)): Written agreement, fees 3% or less of purchases
- **Waiver of beneficiary cost-sharing** (1001.952(k)): Financial need basis, not advertised

**Differences from Stark Law:**
| Feature | Stark Law | Anti-Kickback Statute |
|---------|-----------|----------------------|
| Scope | Physician referrals for DHS to Medicare | Any referrals for any federal healthcare program items/services |
| Intent | Strict liability (no intent required) | Knowing and willful (intent-based) |
| Standard | Must fit exception exactly | Safe harbors voluntary; failure to meet does not = violation |
| Penalties | Civil only | Criminal AND civil |
| Actors | Physicians (and immediate family) | Anyone (providers, vendors, patients, etc.) |

**OIG Advisory Opinions:** OIG issues advisory opinions on whether proposed arrangements violate AKS. Not binding on courts but significant guidance. Requestor-specific; others cannot rely on them but they indicate OIG's analytical framework.

---

## 6. Telehealth & Digital Health Compliance

**State Licensing:** Providers must be licensed in the state where the PATIENT is located at time of service. Each state has its own medical practice act. Some states have special telehealth licenses or registrations.

**Interstate Medical Licensure Compact (IMLC):** Expedited pathway for physicians to obtain licenses in multiple compact member states. 40+ member states as of 2025. Does not create a national license; facilitates multi-state licensure.

**Ryan Haight Act (Controlled Substances):** DEA-registered practitioner must conduct at least one in-person medical evaluation before prescribing controlled substances via telemedicine, UNLESS an exception applies (DEA-registered hospital, VA, IHS, public health emergency declarations). The DEA has proposed special registration for telemedicine prescribers but final rule remains pending.

**Informed Consent for Telehealth:** Most states require specific informed consent for telehealth services, covering: nature of telehealth, technology risks, privacy risks, right to refuse, potential for technical failure, right to in-person care. Some states require written consent; others allow verbal with documentation.

**Remote Patient Monitoring (RPM) / Remote Therapeutic Monitoring (RTM):**
- RPM (CPT 99453-99458): Collection and interpretation of physiologic data (weight, BP, pulse ox, respiratory flow rate). Requires FDA-cleared device.
- RTM (CPT 98975-98981): Non-physiologic data (medication adherence, therapy adherence, pain scales). Does not require FDA-cleared device.
- Compliance considerations: Medical necessity documentation, patient consent, data security, device management, billing accuracy (incident-to rules, supervision requirements).

**State Telehealth Parity Laws:** Many states require insurers to reimburse telehealth services at the same rate as in-person services ("payment parity"). Some require coverage parity (must cover if in-person equivalent is covered). Requirements vary significantly by state.

**Digital Therapeutics (DTx):** Software-based interventions that deliver evidence-based therapeutic interventions. May be FDA-regulated as SaMD. Regulatory pathway depends on claims, risk, and clinical evidence.

---

## 7. FDA Regulatory Framework (HealthTech/MedTech)

**Device Classification:**
- **Class I:** Low risk (tongue depressors, bandages). General controls. Most exempt from 510(k).
- **Class II:** Moderate risk (powered wheelchairs, pregnancy tests, infusion pumps). General controls + special controls. Most require 510(k).
- **Class III:** High risk (heart valves, implantable pacemakers). General controls + premarket approval (PMA).

**Premarket Pathways:**
- **510(k):** Demonstrate substantial equivalence to a legally marketed predicate device. Most common pathway (~3,000/year).
- **PMA:** Clinical evidence of safety and effectiveness. Reserved for Class III devices. Most rigorous pathway.
- **De Novo:** Novel devices with no predicate but low-to-moderate risk. Creates new classification and can serve as predicate for future 510(k)s.

**Software as a Medical Device (SaMD):**
- International Medical Device Regulators Forum (IMDRF) framework adopted by FDA
- Risk categorization based on: significance of information provided (treat/diagnose/drive/inform) x seriousness of health condition (critical/serious/non-serious)
- FDA has stated it will focus enforcement on higher-risk SaMD
- Must meet applicable QSR (Quality System Regulation) requirements

**Clinical Decision Support (CDS) Exemption (21st Century Cures Act, Section 3060):**
Software qualifies for exemption if ALL FOUR criteria met:
1. Not intended to acquire, process, or analyze a medical image, signal, or pattern from an in vitro diagnostic device
2. Intended to display, analyze, or print medical information about a patient or other medical information
3. Intended to be used as a supportive tool for healthcare professionals (not intended to replace clinical judgment)
4. Intended for the purpose of enabling the healthcare professional to independently review the basis for the recommendation

**Digital Health Pre-Certification (Pre-Cert) Program:** FDA pilot program (paused/being reconsidered) for evaluating SaMD organizations rather than individual products. Would allow streamlined review for organizations demonstrating excellence in software design, development, and monitoring.

**Laboratory Developed Tests (LDTs) and CLIA:**
- CLIA (Clinical Laboratory Improvement Amendments): All labs performing testing on human specimens must be CLIA-certified. Regulates lab processes, not specific tests.
- LDTs: Tests designed, manufactured, and used within a single laboratory. FDA has historically exercised enforcement discretion. Final rule published 2024 phasing in FDA oversight over 4 years (currently subject to legal challenges).

---

## 8. State-Level Healthcare Compliance

**State Privacy Laws Exceeding HIPAA:**
- **California (CCPA/CPRA + CMIA):** Confidentiality of Medical Information Act provides broader protections than HIPAA. Applies to employers and others beyond HIPAA CEs. CCPA/CPRA exempts PHI governed by HIPAA but covers health data not within HIPAA scope.
- **Washington (My Health My Data Act):** Broad definition of "consumer health data" beyond HIPAA PHI. Applies to any entity collecting health data of WA residents. Requires consent, geofencing restrictions near healthcare facilities, private right of action.
- **Texas (HB 300):** More restrictive than HIPAA on training requirements, authorization requirements, and penalties (up to $250,000 per violation).
- **New York (SHIELD Act):** Broader breach notification requirements, expanded definition of private information, mandatory reasonable security safeguards.
- **Nevada (SB 370):** Consumer health data protections similar to Washington.

**Corporate Practice of Medicine Doctrine (CPOM):**
Prohibits corporations from employing physicians or practicing medicine directly. Significant variation by state:
- **Strict enforcement:** CA, TX, NY, IL, OH, CO, NJ — corporations cannot employ physicians; must use management services organization (MSO) + friendly PC model
- **Moderate:** FL, PA, GA — some exceptions for certain entity types
- **Permissive/No doctrine:** Several states have no CPOM doctrine or broadly permit corporate employment

**State Anti-Kickback Laws:** Many states have their own anti-kickback or fee-splitting statutes that may: (a) apply to commercial payors (not just federal programs), (b) have different safe harbors, (c) impose different penalties. California, New York, and Texas have particularly active state AKS enforcement.

**State Telehealth Regulations:** Key variations include: which providers may deliver telehealth, acceptable modalities (audio-only, store-and-forward, RPM), prescribing restrictions, informed consent requirements, and supervision requirements.

**Certificate of Need (CON):** ~35 states and DC require CON for certain healthcare facility construction, expansion, or major equipment acquisition. Requirements vary by state and service type. Must be analyzed for any facility expansion, new service line, or major capital expenditure in a CON state.

---

## 9. Healthcare Compliance Review Matrix

When conducting a healthcare compliance review, use this framework:

```
| Regulation | Requirement | Current Status | Gap | Risk Level | Remediation | Timeline |
|------------|-------------|----------------|-----|------------|-------------|----------|
| HIPAA Privacy | NPP distributed | [Y/N/Partial] | [Description] | [Critical/High/Medium/Low] | [Action items] | [Target date] |
| HIPAA Privacy | Individual access process | | | | | |
| HIPAA Privacy | Minimum necessary policies | | | | | |
| HIPAA Privacy | Authorization forms compliant | | | | | |
| HIPAA Privacy | De-identification procedures | | | | | |
| HIPAA Security | Risk analysis completed | | | | | |
| HIPAA Security | Encryption at rest (ePHI) | | | | | |
| HIPAA Security | Encryption in transit (ePHI) | | | | | |
| HIPAA Security | Access controls / MFA | | | | | |
| HIPAA Security | Audit logging active | | | | | |
| HIPAA Security | Contingency / DR plan tested | | | | | |
| HIPAA Security | Workforce training current | | | | | |
| HIPAA Breach | Breach response plan documented | | | | | |
| HIPAA Breach | Breach risk assessment template | | | | | |
| HIPAA Breach | Notification procedures tested | | | | | |
| BAA | BAAs executed with all BAs | | | | | |
| BAA | Subcontractor flow-down | | | | | |
| BAA | BA inventory current | | | | | |
| Stark Law | Physician arrangements documented | | | | | |
| Stark Law | FMV documented for all arrangements | | | | | |
| Stark Law | Exception analysis on file | | | | | |
| Anti-Kickback | Referral arrangements reviewed | | | | | |
| Anti-Kickback | Safe harbor analysis documented | | | | | |
| Anti-Kickback | Marketing/incentive programs reviewed | | | | | |
| Telehealth | Provider licensing in patient states | | | | | |
| Telehealth | Informed consent obtained | | | | | |
| Telehealth | Controlled substance prescribing compliant | | | | | |
| FDA/SaMD | Device classification determined | | | | | |
| FDA/SaMD | CDS exemption analysis documented | | | | | |
| FDA/SaMD | QSR compliance (if applicable) | | | | | |
| State Law | CPOM structure compliant | | | | | |
| State Law | State privacy law compliance | | | | | |
| State Law | State AKS compliance | | | | | |
| State Law | CON requirements assessed | | | | | |
```

**Risk Level Definitions:**
- **Critical:** Active violation or imminent enforcement risk. Immediate action required (0-30 days).
- **High:** Material gap likely to result in enforcement action or significant financial exposure. Action required within 60 days.
- **Medium:** Gap exists but mitigating controls partially in place. Address within 90 days.
- **Low:** Best practice gap; no immediate regulatory exposure. Address within 180 days.

---

## Quick Reference: Key Deadlines and Thresholds

| Item | Deadline/Threshold |
|------|-------------------|
| Breach notification to individuals | 60 days from discovery |
| Breach notification to HHS (500+) | 60 days from discovery |
| Breach notification to HHS (<500) | Annual, within 60 days of calendar year end |
| Media notification | 60 days (500+ in a state/jurisdiction) |
| BA breach notification to CE | 60 days from discovery (negotiate shorter) |
| Access request response | 30 days (one 30-day extension) |
| Amendment request response | 60 days (one 30-day extension) |
| HIPAA complaint filing deadline | 180 days from knowledge of violation |
| OCR corrective action plan | Typically 1-3 years |
| Stark Law FMV update | At least annually recommended |
| Security Rule risk analysis | At least annually recommended |

---

*Reference compiled for Weybre AI Compliance Counsel agent. Not legal advice. Verify current regulatory status before application — regulations and enforcement positions change. Last structured update: 2025.*
