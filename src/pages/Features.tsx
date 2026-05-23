import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenCheck, ScrollText, FileText, Gavel, FolderKanban, Scale, FileSearch, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";


type Feature = {
  tag: string;
  title: string;
  intro: string;
  bullets: string[];
  use_cases: { h: string; p: string }[];
  cta: string;
  icon: React.ReactNode;
};

const features: Record<string, Feature> = {
  research: {
    tag: "Case-law Research",
    title: "Ask in plain English. Get cited Indian case law.",
    intro: "Hybrid semantic + keyword search across the Supreme Court of India corpus. Streaming AI answers with inline citation chips you can click straight to the source.",
    bullets: [
      "Full SC corpus (2000–present), High Courts rolling out",
      "Streaming answers with inline citations and quoted excerpts",
      "Attach your own documents — AI reads and grounds answers on them",
      "Save research notes to matters, export to PDF or DOCX",
      "Neutral citation format (e.g. 2023 INSC 1043) accepted in court",
    ],
    use_cases: [
      { h: "Pre-hearing prep", p: "Pull the strongest precedents on a narrow question of law in minutes, not hours." },
      { h: "Junior brief", p: "Hand a junior a cited starting point instead of an empty research task." },
    ],
    cta: "Try Research",
    icon: <BookOpenCheck className="h-5 w-5" />,
  },
  "web-search": {
    tag: "AI Web Search",
    title: "Live, cited search across the open legal web.",
    intro: "Grounded with Gemini's google_search tool — bare acts, gazettes, court orders and legal news, every answer carrying its URL and a quoted excerpt.",
    bullets: [
      "Real-time grounding — never stale",
      "Bare acts, notifications, gazettes, legal news",
      "Attach your own briefs to anchor the search to your facts",
      "Inline source URLs and direct quotes for verification",
    ],
    use_cases: [
      { h: "Tracking amendments", p: "Surface the latest notification or circular on a statute before drafting." },
      { h: "Cross-jurisdiction", p: "Compare positions across HC orders and tribunal rulings in one query." },
    ],
    cta: "Try Web Search",
    icon: <ScrollText className="h-5 w-5" />,
  },
  drafts: {
    tag: "Draft Assist",
    title: "Draft Indian contracts grounded in precedent.",
    intro: "NDA, Employment, Service, Notice, Reply, Vakalatnama and more — generated, reviewed, or rewritten with clause-level risk flags.",
    bullets: [
      "Draft from scratch or upload a draft for clause-level review",
      "Multilingual OCR fallback for scanned and regional-language PDFs",
      "‘Cite a precedent’ backed by real SC judgments",
      "Auto-draft Reply to Notice / Written Statement from a case brief",
      "Export to DOCX or PDF, save to a matter",
    ],
    use_cases: [
      { h: "Reply to notice", p: "Generate a structured Written Statement grounded in case facts and precedent." },
      { h: "Contract review", p: "Upload a vendor draft and get clause-level risk flags and rewrites." },
    ],
    cta: "Open Drafts",
    icon: <FileText className="h-5 w-5" />,
  },
  litigation: {
    tag: "Litigation Intel",
    title: "From CNR to courtroom-ready brief.",
    intro: "Pull live case data from court APIs, generate a structured brief with precedents, and flag fraud or predatory patterns — at scale.",
    bullets: [
      "Single-CNR or batch intake (up to 50 CNRs in parallel)",
      "Auto-generated brief: parties, court, hearing date, issues",
      "Fraud & predatory-pattern flags (suspicious notarization, repeat plaintiffs, limitation gymnastics)",
      "One-click ‘Draft Reply’ — pushes the brief into Draft Assist",
    ],
    use_cases: [
      { h: "Mass litigation", p: "Triage hundreds of consumer or recovery matters in a single sitting." },
      { h: "First-hearing brief", p: "Walk into court with a cited brief instead of a CNR printout." },
    ],
    cta: "Open Litigation Intel",
    icon: <Gavel className="h-5 w-5" />,
  },
  diligence: {
    tag: "Diligence",
    title: "Documents × questions, answered in a matrix.",
    intro: "Upload a data room, define your questions, and get a virtualized grid of cited answers with realtime updates as the model works through each cell.",
    bullets: [
      "Docs × questions matrix with virtualized grid",
      "Realtime cell updates while the AI processes",
      "Multilingual OCR for scanned and regional-language docs",
      "CSV export for client deliverables",
    ],
    use_cases: [
      { h: "M&A diligence", p: "Run 30 questions across a 200-document data room without a junior army." },
      { h: "Vendor review", p: "Standardize compliance checks across hundreds of supplier contracts." },
    ],
    cta: "Open Diligence",
    icon: <FileSearch className="h-5 w-5" />,
  },
  decide: {
    tag: "Decision Engine",
    title: "Frame the question. See the call.",
    intro: "Structured legal decisioning — give the engine the facts and the question, get a reasoned recommendation with the precedents that drove it.",
    bullets: [
      "Structured fact intake — no prompt engineering required",
      "Reasoned recommendation with cited authorities",
      "Confidence band and dissenting authority surfaced",
    ],
    use_cases: [
      { h: "Should we appeal?", p: "Get a precedent-backed view on prospects before the client meeting." },
      { h: "Settlement vs trial", p: "Frame both paths against the cited authority on quantum." },
    ],
    cta: "Open Decision Engine",
    icon: <Scale className="h-5 w-5" />,
  },
  matters: {
    tag: "Matters",
    title: "One workspace per matter. Everything cited.",
    intro: "Your private workspace per case — research notes, drafts, uploaded documents, hearing notes, all bound to the matter and exportable on demand.",
    bullets: [
      "Per-matter notes, drafts, and uploads",
      "Row-level isolation — your matters stay yours",
      "One-click export of the full matter file",
      "DPDP-aligned data residency",
    ],
    use_cases: [
      { h: "Client handoff", p: "Export a full, cited matter file when handing off to co-counsel." },
      { h: "Audit trail", p: "Keep every research query and draft version tied to the matter." },
    ],
    cta: "Open Matters",
    icon: <FolderKanban className="h-5 w-5" />,
  },
};

export const featureList = Object.entries(features).map(([slug, f]) => ({ slug, ...f }));

const Features = () => {
  const { slug } = useParams<{ slug: string }>();
  const feature = slug ? features[slug] : undefined;

  if (!slug || !feature) {
    return (
      <div className="min-h-screen bg-hero">
        <Seo
          title="Features — AI legal research, drafting & diligence for India"
          description="Case-law search across SC India, cited AI web search, contract Draft Assist, document Diligence and a structured Decision Engine — built for Indian advocates."
          path="/features"
        />
        <Header />
        <main className="container max-w-6xl py-12">

          <p className="font-mono text-xs uppercase tracking-wider text-accent">Product</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-primary md:text-5xl">Features</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A focused suite of AI tools for Indian advocates — every output cited, every workspace private.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureList.map((f) => (
              <Link
                key={f.slug}
                to={`/features/${f.slug}`}
                className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  {f.icon}
                </div>
                <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{f.tag}</p>
                <h3 className="mt-2 font-serif text-xl text-primary">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.intro}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-accent group-hover:underline">
                  Learn more <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero">
      <Seo
        title={`${feature.title} — Weybre AI`}
        description={feature.intro.slice(0, 158)}
        path={`/features/${slug}`}
        ogType="article"
      />
      <Header />
      <main className="container max-w-4xl py-12">

        <p className="font-mono text-xs uppercase tracking-wider text-accent">{feature.tag}</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-primary md:text-5xl">
          {feature.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">{feature.intro}</p>

        <section className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl text-primary">What you get</h2>
          <ul className="mt-4 space-y-3">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {feature.use_cases.map((u) => (
            <div key={u.h} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-serif text-lg text-primary">{u.h}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{u.p}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth?mode=signup">{feature.cta} <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/features">All features</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          AI-generated outputs must be independently verified by a licensed advocate before filing or advice.
        </p>
      </main>
    </div>
  );
};

const Header = () => (
  <header className="border-b border-border/60 bg-background/85 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <Link to="/"><Logo /></Link>
      <Button asChild variant="outline" size="sm">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Back</Link>
      </Button>
    </div>
  </header>
);

export default Features;
