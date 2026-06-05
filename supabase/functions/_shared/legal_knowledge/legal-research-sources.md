# Legal Research Sources & Methodology

Weybre AI's Legal Researcher agent has access to live data sources via `scripts/legal_research.py`. This reference documents available sources, search strategies, and citation verification protocols.

## Available Data Sources

### 1. CourtListener API (Primary — Case Law)
- **Coverage**: 400M+ court documents, all federal and state courts
- **Data**: Opinions, dockets, oral arguments, PACER records
- **Auth**: Token-based (set `COURTLISTENER_API_TOKEN` env var or place in a `.env` file)
- **Script**: `python3 scripts/legal_research.py search "query" [options]`

#### Search Commands

```bash
# Search opinions (case law)
python3 scripts/legal_research.py search "non-compete enforceability" --jurisdiction cal --limit 10

# Search with date filter
python3 scripts/legal_research.py search "HIPAA breach" --after 2020-01-01 --order "dateFiled desc"

# Look up by citation
python3 scripts/legal_research.py citation "410 U.S. 113"

# Get full opinion text
python3 scripts/legal_research.py case <cluster_id>

# Get docket details
python3 scripts/legal_research.py docket <docket_id>

# List courts for filtering
python3 scripts/legal_research.py courts --jurisdiction F
```

#### Search Tips
- Use **boolean operators**: `AND`, `OR`, `NOT`, quotes for exact phrases
- Use **field-specific search**: `caseName:"Smith"`, `judge:"Roberts"`
- **Jurisdiction codes** (common): `scotus`, `ca9`, `cal`, `ny`, `del`, `delch`, `tex`, `fla`
- **Order by**: `score desc` (relevance), `dateFiled desc` (newest), `dateFiled asc` (oldest)
- Run `python3 scripts/legal_research.py jurisdictions` for the full code list

### 2. WebSearch + WebFetch (Secondary — Statutes, Regulations, Commentary)

For statutory and regulatory research, use the built-in web tools:

| Source | URL Pattern | What You Get |
|--------|-------------|-------------|
| **Cornell LII** | `law.cornell.edu/uscode/text/{title}/{section}` | Federal statutes (USC) |
| **Cornell CFR** | `law.cornell.edu/cfr/text/{title}/part-{part}` | Federal regulations (CFR) |
| **Congress.gov** | `congress.gov/bill/{congress}/{type}/{number}` | Bills and legislative history |
| **Federal Register** | `federalregister.gov/documents/search?conditions[term]=X` | Proposed/final rules |
| **Google Scholar** | `scholar.google.com/scholar?q=X&as_sdt=4` | Case law search (alternate) |
| **Justia** | `law.justia.com/codes/{state}/` | State statutes |
| **State Legislature Sites** | Varies by state | Current session bills |

#### Search Strategy by Source Type

**For case law** (use CourtListener first):
1. Search CourtListener with specific legal terms
2. Filter by jurisdiction and date range
3. Get full opinion text for relevant cases
4. Cross-reference citations with `citation` command
5. Fall back to Google Scholar via WebSearch if CourtListener gaps

**For federal statutes**:
1. WebFetch from `law.cornell.edu/uscode/text/{title}/{section}`
2. Check for recent amendments via Congress.gov
3. Note effective dates — some provisions have delayed effective dates

**For federal regulations (CFR)**:
1. WebFetch from `law.cornell.edu/cfr/text/{title}/part-{part}`
2. Check Federal Register for proposed rules that may change current reg
3. Note: CFR is updated annually by title — check e-CFR for most current

**For state law**:
1. WebSearch: `site:law.justia.com [state] [topic]`
2. Or WebFetch the specific state legislature's statute search
3. Note: state law changes frequently — always flag date sensitivity

### 3. USPTO / PatentsView (Patent Research)

```bash
# Search patents by keyword
python3 scripts/legal_research.py patent-search "machine learning diagnosis" --limit 5

# Get specific patent details
python3 scripts/legal_research.py patent 11123456
```

**Note**: The primary USPTO API was deprecated. The script falls back to PatentsView API which may have coverage gaps for very recent patents. For critical patent research, supplement with:
- `WebSearch "site:patents.google.com [query]"` — Google Patents
- `WebFetch "https://patents.google.com/patent/US{number}"` — Specific patent

## Citation Verification Protocol

**CRITICAL**: AI can hallucinate case law. Every citation from the Legal Researcher MUST be verified.

### Verification Steps

1. **For case citations**: Run `python3 scripts/legal_research.py citation "[cite]"` to confirm the case exists
2. **For statute citations**: WebFetch the Cornell LII URL to confirm the section exists and says what we claim
3. **For regulation citations**: WebFetch the CFR section to confirm current text

### Confidence Tags for Research

| Tag | Meaning | When to Use |
|-----|---------|-------------|
| `[VERIFIED-CL]` | Case confirmed via CourtListener API | Case found, citation matches, text reviewed |
| `[VERIFIED-WEB]` | Statute/reg confirmed via web source | Text retrieved and matches our claim |
| `[VERIFY]` | Not yet verified — needs human check | Default for all initial citations |
| `[NOT-FOUND]` | Could not verify via available sources | Searched CourtListener + web, no match |
| `[SUPERSEDED]` | Case overruled or statute amended | Later authority found that changes the analysis |

### Research Output Format

When the Legal Researcher completes a research task, output should include:

```markdown
## Research Results — [Topic]

### Key Cases
| Case | Citation | Court | Year | Relevance | Verified |
|------|----------|-------|------|-----------|----------|
| Smith v. Jones | 123 F.3d 456 | 9th Cir. | 2020 | Directly on point | [VERIFIED-CL] |

### Applicable Statutes
| Statute | Citation | Jurisdiction | Current? | Verified |
|---------|----------|-------------|----------|----------|
| CCPA | Cal. Civ. Code § 1798.100 | California | Yes | [VERIFIED-WEB] |

### Regulatory Guidance
| Agency | Document | Date | Type | Verified |
|--------|----------|------|------|----------|
| FTC | Endorsement Guides | 2023 | Final Rule | [VERIFIED-WEB] |

### Research Methodology
- Sources searched: [list]
- Date range: [range]
- Jurisdiction focus: [state/federal]
- Search terms used: [list actual queries]
- Total results reviewed: [number]
- Gaps/limitations: [what couldn't be found]
```

## Common Research Patterns

### Pattern: "Is [action] legal in [state]?"
1. Identify the legal area (employment, privacy, contract, etc.)
2. Search CourtListener for relevant state case law
3. WebFetch the applicable state statute from Justia
4. Check for federal preemption issues
5. Synthesize into IRAC memo

### Pattern: "What's the current law on [topic]?"
1. Identify federal vs state jurisdiction
2. Get the statutory framework (Cornell LII / Justia)
3. Search CourtListener for recent interpretive case law (last 5 years)
4. Check for pending legislation or rulemaking
5. Note circuit splits or state variations

### Pattern: "Find cases supporting [position]"
1. Search CourtListener with position-specific terms
2. Filter by jurisdiction and favorable courts
3. Get full opinion text for top results
4. Extract holdings and key quotes
5. Also search for adverse authority (opposing cases) — duty of candor
6. Rate each case: directly on point / analogous / distinguishable

### Pattern: "Verify this citation"
1. Run `citation` command in legal_research.py
2. If found: confirm case name, date, court match
3. If not found: search by case name as fallback
4. Check if the case has been overruled (search for later cases citing it)
5. Tag as [VERIFIED-CL], [VERIFY], or [NOT-FOUND]

### Pattern: "Patent/IP landscape for [technology]"
1. Search USPTO/PatentsView for relevant patents
2. WebSearch Google Patents for broader coverage
3. Identify key patent holders and claim scope
4. Note patent expiration dates
5. Flag potential FTO (freedom to operate) issues

## Jurisdiction Quick Reference

### Federal Courts
- `scotus` — Supreme Court of the United States
- `ca1` through `ca11` — Circuit Courts of Appeals
- `cadc` — D.C. Circuit
- `cafc` — Federal Circuit (patent cases)
- `cacd`, `nysd`, `txsd`, etc. — District Courts

### Key State Courts
- `cal` / `calctapp` — California Supreme Court / Court of Appeal
- `ny` / `nyappdiv` — New York Court of Appeals / Appellate Division
- `del` / `delch` — Delaware Supreme Court / Court of Chancery (corporate law!)
- `tex` / `texapp` — Texas Supreme Court / Court of Appeals
- `mass` — Massachusetts Supreme Judicial Court

### Specialized
- `delch` — Delaware Chancery (corporate governance, M&A disputes)
- `cafc` — Federal Circuit (patents, international trade)
- `uscfc` — Court of Federal Claims (government contracts)
- `bap9` etc. — Bankruptcy Appellate Panels
