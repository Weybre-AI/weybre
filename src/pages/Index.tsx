import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, FileText, ShieldCheck, ScrollText, Lock, Gavel, Check, Quote } from "lucide-react";
import { Seo } from "@/components/Seo";
import { MarketingNav } from "@/components/MarketingNav";


const themeStyle: React.CSSProperties & Record<string, string> = {
  ["--background"]: "201 100% 13%",
  ["--foreground"]: "0 0% 100%",
  ["--muted-foreground"]: "240 4% 66%",
  ["--primary"]: "0 0% 100%",
  ["--primary-foreground"]: "0 0% 4%",
  ["--secondary"]: "0 0% 10%",
  ["--muted"]: "0 0% 10%",
  ["--accent"]: "0 0% 100%",
  ["--accent-foreground"]: "0 0% 4%",
  ["--card"]: "201 80% 9%",
  ["--card-foreground"]: "0 0% 100%",
  ["--border"]: "0 0% 18%",
  ["--input"]: "0 0% 18%",
  fontFamily: "'Inter', sans-serif",
};

const serif = { fontFamily: "'Instrument Serif', serif" };

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4";

const Index = () => {
  return (
    <div style={themeStyle} className="min-h-screen w-full bg-background text-foreground">
      <Seo
        title="Weybre AI — AI Co-Counsel for Indian Lawyers"
        description="AI legal research with Supreme Court case-law search, cited web answers, draft assist and diligence. Turn 8 hours of research into 8 minutes."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Is Weybre AI built for Indian law?", acceptedAnswer: { "@type": "Answer", text: "Yes. Case-law search is anchored on the Supreme Court of India corpus, and every output uses Indian neutral citation format." } },
            { "@type": "Question", name: "Do I need to verify Weybre AI's outputs?", acceptedAnswer: { "@type": "Answer", text: "Yes. Every AI output is advisory and must be independently verified by a licensed advocate before filing or advice." } },
            { "@type": "Question", name: "Is my client data private?", acceptedAnswer: { "@type": "Answer", text: "Yes. Matters are row-level isolated per user and per organization, with DPDP-aligned data residency." } },
          ],
        }}
      />
      {/* ===== HERO with fullscreen video ===== */}
      <div className="relative min-h-screen w-full overflow-hidden">

        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={VIDEO_SRC}
        />
        <div className="absolute inset-0 z-0 bg-background/40" />

        <MarketingNav
          cta={
            <Link
              to="/auth?mode=signup"
              className="liquid-glass rounded-full px-4 py-2 text-sm text-foreground hover:scale-[1.03] sm:px-6 sm:py-2.5"
            >
              <span className="hidden sm:inline">Get Your First Cited Answer</span>
              <span className="sm:hidden">Get started</span>
            </Link>
          }
        />

        {/* Hero copy */}
        <section className="relative z-10 flex flex-col items-center px-6 pt-24 pb-32 text-center md:pt-32 md:pb-40">
          <span className="animate-fade-rise mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/30 px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
            Founding 50 firms · Priority onboarding
          </span>
          <h1
            style={{ ...serif, letterSpacing: "-2.46px" }}
            className="animate-fade-rise max-w-7xl text-4xl font-normal leading-[0.95] sm:text-7xl md:text-8xl"
          >
            Turn <em className="not-italic text-muted-foreground">8 hours</em> of research into{" "}
            <em className="not-italic text-muted-foreground">8 cited minutes.</em>
          </h1>
          <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            The only AI that cites every clause, judgment, and news article — with paragraph-level precision. For Indian advocates, by Indian advocates.
          </p>
          <div className="animate-fade-rise-delay-2 mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/auth?mode=signup"
              className="liquid-glass cursor-pointer rounded-full px-8 py-4 text-base text-foreground hover:scale-[1.03] sm:px-14 sm:py-5"
            >
              Get Your First Cited Answer →
            </Link>
            <a
              href="#how"
              className="rounded-full px-6 py-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Or watch a 3-min demo <ArrowRight className="ml-1 inline h-4 w-4" />
            </a>
          </div>
          <p className="animate-fade-rise-delay-2 mt-6 text-xs text-muted-foreground">
            Card required · Cancel anytime · GST invoice included · No call, no demo to book
          </p>
        </section>
      </div>

      {/* ===== Trust strip ===== */}
      <section className="relative border-y border-border/40 bg-background/60 py-6 backdrop-blur-sm">
        <div className="container flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>🇮🇳 DPDP-aligned data residency</span>
          <span className="opacity-40">•</span>
          <span>Supreme Court of India · 18,000+ judgments</span>
          <span className="opacity-40">•</span>
          <span>25 High Courts on roadmap</span>
          <span className="opacity-40">•</span>
          <span>BCI-aware disclosures</span>
        </div>
      </section>

      {/* ===== Product ===== */}
      <section id="product" className="container py-24">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">The Product</p>
          <h2 style={serif} className="text-4xl leading-tight text-foreground md:text-6xl">
            Three modules. <em className="not-italic text-muted-foreground">One quiet workspace.</em>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every answer grounded in cited judgments. Every clause backed by precedent. No black boxes, no hallucinated citations.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            tag="Case-law"
            title="Ask in plain English. Get cited Indian case law."
            bullets={[
              "Hybrid semantic + keyword search over the SC corpus",
              "Streaming AI answers with inline citation chips",
              "Save research notes to matters, export to PDF or DOCX",
            ]}
          />
          <FeatureCard
            icon={<ScrollText className="h-5 w-5" />}
            tag="Web search"
            title="Live, cited search across the open legal web."
            bullets={[
              "Grounded with Gemini google_search tool — no extra keys",
              "Bare acts, gazettes, court orders and legal news",
              "Every answer carries the URL and the quoted excerpt",
            ]}
          />
          <FeatureCard
            icon={<FileText className="h-5 w-5" />}
            tag="Draft Assist"
            title="Draft Indian contracts grounded in precedent."
            bullets={[
              "NDA, Employment, Service, Notice, Reply, Vakalatnama",
              "Upload a draft — get clause-level risk flags & rewrites",
              "'Cite a precedent' backed by real SC judgments",
            ]}
          />
        </div>
      </section>

      {/* ===== Pillars ===== */}
      <section className="relative border-y border-border/40 bg-background/60 py-24">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Trust pillars</p>
            <h2 style={serif} className="text-4xl text-foreground md:text-5xl">
              Built for the <em className="not-italic text-muted-foreground">courtroom standard.</em>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Pillar icon={<ShieldCheck className="h-5 w-5" />} title="Honest by default" body="Every AI output shows ‘Verify before filing’. Every citation is clickable to its source." />
            <Pillar icon={<ScrollText className="h-5 w-5" />} title="Indian citation format" body="Outputs use the neutral citation system (e.g. 2023 INSC 1043) accepted in Indian courts." />
            <Pillar icon={<Lock className="h-5 w-5" />} title="DPDP-compliant" body="Your matters and queries stay private. One-click delete-my-data in Settings." />
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="container py-24">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">How it works</p>
          <h2 style={serif} className="text-4xl text-foreground md:text-5xl">From query to citation in three steps.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Step n={1} title="Ask" body="Type a legal question — in English or Hindi — the way you'd ask a junior associate." />
          <Step n={2} title="Retrieve" body="Hybrid search pulls the most relevant SC judgments and live web sources." />
          <Step n={3} title="Answer" body="A grounded answer with inline citations, direct quotes, and a clear reasoning trail." />
        </div>

        {/* Sample citation card */}
        <div className="mx-auto mt-14 max-w-xl">
          <div className="liquid-glass rounded-2xl p-6">
            <div className="mb-2 flex items-center gap-2">
              <Quote className="h-4 w-4 text-foreground" />
              <span className="text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground">Cited answer</span>
            </div>
            <p style={serif} className="text-xl leading-snug text-foreground">
              "Specific performance was denied due to inordinate delay in seeking relief…"
            </p>
            <p className="mt-3 text-[0.7rem] tracking-wider text-muted-foreground">2023 INSC 1043 · Para 27</p>
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section className="relative border-y border-border/40 bg-background/60 py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Voices from the bar</p>
            <h2 style={serif} className="text-4xl text-foreground md:text-5xl">
              Results from <em className="not-italic text-muted-foreground">real advocates.</em>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Testimonial
              img="https://images.unsplash.com/photo-1556157382-97eda2d62296?w=200&h=200&fit=crop&crop=faces"
              quote="I found a key SC precedent in 8 minutes that I'd missed in 6 hours of manual searching. Weybre is now my first stop for any research."
              name="Adv. Rohan Mehta"
              role="Litigation, Delhi High Court"
            />
            <Testimonial
              img="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=faces"
              quote="Cut my contract review time by 70%. The clause-level risk flags caught two issues I would have flagged on a third read."
              name="Adv. Priya Iyer"
              role="Partner, Corporate Practice"
            />
            <Testimonial
              img="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=faces"
              quote="What I love most: every citation is clickable. No hallucinations, no guesswork. It earned my trust in the first week."
              name="Adv. Karan Singh"
              role="Independent Counsel, Bombay"
            />
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="relative border-y border-border/40 bg-background/60 py-24">
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">Pricing</p>
            <h2 style={serif} className="text-4xl text-foreground md:text-5xl">
              Pay for <em className="not-italic text-muted-foreground">what you use.</em>
            </h2>
            <p className="mt-3 text-muted-foreground">Every plan includes AI credits that reset monthly. No freemium. No hidden fees.</p>
          </div>

          <div className="mb-8 flex flex-wrap justify-center gap-3">
            {[
              { label: "Research query", cr: 1 },
              { label: "Draft generation", cr: 1 },
              { label: "Litigation brief", cr: 2 },
              { label: "Decision engine", cr: 2 },
              { label: "Contract analysis", cr: 3 },
            ].map(c => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-background/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                <span className="font-semibold text-foreground">{c.cr}cr</span>
                {c.label}
              </span>
            ))}
          </div>

          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
            <PriceCard
              name="Starter"
              price="1,999"
              credits="100 credits / month"
              period="/lawyer / month"
              highlight={false}
              badge={null}
              features={[
                "100 AI credits / month",
                "Case-law research (1cr)",
                "Contract drafting (1cr)",
                "Matter management",
                "Export PDF & DOCX",
                "GST invoices",
                "Email support",
              ]}
            />
            <PriceCard
              name="Professional"
              price="4,999"
              credits="500 credits / month"
              period="/lawyer / month"
              highlight={true}
              badge="Most popular"
              features={[
                "500 AI credits / month",
                "Everything in Starter",
                "Litigation Intel + eCourts (2cr)",
                "Contract analysis (3cr)",
                "Decision engine (2cr)",
                "Audit log",
                "Priority support",
              ]}
            />
            <PriceCard
              name="Firm"
              price="14,999"
              credits="2,000 pooled credits"
              period="/month · up to 5 seats"
              highlight={false}
              badge="Best value"
              features={[
                "2,000 pooled credits / month",
                "Up to 5 lawyer seats",
                "Everything in Professional",
                "Shared matters",
                "Dedicated onboarding",
                "SLA support",
              ]}
            />
          </div>

          <div className="mx-auto mt-6 max-w-5xl rounded-2xl border border-foreground/20 bg-background/40 p-6 text-center backdrop-blur-sm">
            <p className="font-medium text-foreground">Enterprise — Unlimited seats · Unlimited credits · API access · Custom integrations</p>
            <p className="mt-1 text-sm text-muted-foreground">₹50,000 – ₹3,00,000 / month · Dedicated account manager · On-premise option</p>
            <Link to="/legal/contact" className="mt-3 inline-block text-sm text-muted-foreground underline hover:text-foreground">
              Contact sales →
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Prices in INR, exclusive of GST. Card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="container py-24">
        <div className="mx-auto max-w-3xl">
          <h2 style={serif} className="mb-12 text-center text-4xl text-foreground md:text-5xl">
            Honest answers to <em className="not-italic text-muted-foreground">honest questions.</em>
          </h2>
          <div className="space-y-4">
            <Faq q="Will Weybre AI hallucinate citations?" a="Our hybrid retrieval grounds every answer in real SC judgments and live web sources before the LLM responds. Every citation is clickable to its source. We deliberately surface ‘Verify before filing’ on every output — AI is a co-counsel, not a substitute." />
            <Faq q="Is my client data safe?" a="Yes. Your matters, drafts and queries are isolated per-account with row-level security. Data is hosted in India in alignment with the DPDP Act. You can delete all your data with one click in Settings." />
            <Faq q="Which sources are covered?" a="Case law: full Supreme Court of India corpus (2000–present), with High Courts rolling out month-by-month. Web: live, cited search across legal news, government portals, journals and bare acts." />
            <Faq q="What about the Bar Council and UPL rules?" a="Weybre AI is a productivity tool for licensed advocates. We collect your Bar Council number at signup, and every output carries a clear AI-generated disclosure. Weybre AI does not provide legal advice or solicit work from the public." />
            <Faq q="Can I cancel anytime?" a="Yes. Self-serve cancellation in Settings. You keep access through the end of the billing period and can export your matters before leaving." />
            <Faq q="Why should I start today?" a="Every week you wait, you're spending 30+ hours on work Weybre can do in 30 minutes — time you're not billing or winning cases. Our roadmap is also prioritised by early-user feedback, so founding firms shape the product they'll use for years." />
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="container py-24">
        <div className="liquid-glass relative overflow-hidden rounded-3xl p-12 text-center md:p-20">
          <Gavel className="mx-auto mb-6 h-8 w-8 text-foreground" />
          <h2 style={serif} className="text-4xl text-foreground md:text-6xl">
            Win back your <em className="not-italic text-muted-foreground">evenings.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Founding 50 firms get priority onboarding and roadmap input. Subscribe securely with Dodo Payments — no call, no demo.
          </p>
          <Link
            to="/auth?mode=signup"
            className="liquid-glass mt-10 inline-block cursor-pointer rounded-full px-14 py-5 text-base text-foreground hover:scale-[1.03]"
          >
            Get Your First Cited Answer →
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border/40 py-12">
        <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Link to="/" className="text-2xl tracking-tight text-foreground" style={serif}>
              Weybre<sup className="text-xs"> AI</sup>
            </Link>
            <p className="mt-3 max-w-md text-xs text-muted-foreground">
              Weybre AI is a legal research and drafting productivity tool for Indian advocates. Outputs are AI-generated and must be independently verified by a licensed advocate before any filing or advice. Weybre AI does not constitute legal advice and does not solicit work in violation of the Bar Council of India Rules.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground md:justify-end">
            <Link to="/features" className="hover:text-foreground">Features</Link>
            <Link to="/legal/about" className="hover:text-foreground">About</Link>
            <Link to="/legal/trust" className="hover:text-foreground">Trust</Link>
            <Link to="/legal/security-compliance" className="hover:text-foreground">Security & Compliance</Link>
            <Link to="/legal/security-measures" className="hover:text-foreground">Security Measures</Link>
            <Link to="/legal/newsroom" className="hover:text-foreground">Newsroom</Link>
            <Link to="/legal/blog" className="hover:text-foreground">Perspectives</Link>
            <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/legal/security" className="hover:text-foreground">Security</Link>
            <Link to="/legal/refund" className="hover:text-foreground">Refunds</Link>
            <Link to="/legal/disclaimer" className="hover:text-foreground">Disclaimer</Link>
            <Link to="/legal/contact" className="hover:text-foreground">Contact</Link>
            <span>© {new Date().getFullYear()} Weybre AI · Made in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, tag, title, bullets }: { icon: React.ReactNode; tag: string; title: string; bullets: string[] }) => (
  <div className="liquid-glass rounded-2xl p-7">
    <div className="mb-5 flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/10 text-foreground">{icon}</span>
      <span className="text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground">{tag}</span>
    </div>
    <h3 style={serif} className="text-2xl leading-snug text-foreground">{title}</h3>
    <ul className="mt-5 space-y-2.5 text-sm">
      {bullets.map(b => (
        <li key={b} className="flex items-start gap-2 text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Pillar = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="liquid-glass rounded-2xl p-6">
    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-foreground/10 text-foreground">{icon}</div>
    <h4 style={serif} className="text-xl text-foreground">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const Step = ({ n, title, body }: { n: number; title: string; body: string }) => (
  <div className="liquid-glass rounded-2xl p-7">
    <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-sm text-foreground" style={serif}>{n}</div>
    <h4 style={serif} className="text-2xl text-foreground">{title}</h4>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </div>
);

const PriceCard = ({ name, price, credits, period, features, highlight, badge }: { name: string; price: string; credits: string; period: string; features: string[]; highlight: boolean; badge: string | null }) => (
  <div className={`liquid-glass relative flex flex-col rounded-2xl p-8 ${highlight ? "ring-1 ring-foreground/30" : ""}`}>
    {badge && (
      <span className="absolute -top-3 left-7 rounded-full bg-foreground px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-background">
        {badge}
      </span>
    )}
    <h3 style={serif} className="text-2xl text-foreground">{name}</h3>
    <div className="mt-3 flex items-baseline gap-1">
      <span style={serif} className="text-5xl text-foreground">₹{price}</span>
      <span className="text-sm text-muted-foreground">{period}</span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{credits}</p>
    <Link
      to="/pricing"
      className="liquid-glass mt-6 block w-full cursor-pointer rounded-full px-6 py-3 text-center text-sm text-foreground hover:scale-[1.02]"
    >
      Get started →
    </Link>
    <ul className="mt-6 flex-1 space-y-2.5 text-sm">
      {features.map(f => (
        <li key={f} className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground" />
          <span className="text-muted-foreground">{f}</span>
        </li>
      ))}
    </ul>
  </div>
);

const Testimonial = ({ img, quote, name, role }: { img: string; quote: string; name: string; role: string }) => (
  <div className="liquid-glass rounded-2xl p-7">
    <Quote className="mb-4 h-5 w-5 text-foreground/70" />
    <p style={serif} className="text-xl leading-snug text-foreground">"{quote}"</p>
    <div className="mt-6 flex items-center gap-3">
      <img src={img} alt={name} loading="lazy" className="h-11 w-11 rounded-full object-cover ring-1 ring-foreground/20" />
      <div>
        <p className="text-sm text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  </div>
);

const Faq = ({ q, a }: { q: string; a: string }) => (
  <div className="liquid-glass rounded-2xl p-6">
    <h4 style={serif} className="text-xl text-foreground">{q}</h4>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
  </div>
);

export default Index;
