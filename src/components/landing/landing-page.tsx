"use client";

import "./landing.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  Clock3,
  Compass,
  Droplets,
  Factory,
  HardHat,
  HeartHandshake,
  Leaf,
  LockKeyhole,
  MapPin,
  Menu,
  Radar,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   Data
   ───────────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#pillars", label: "Five Pillars" },
  { href: "#brsr-framework", label: "Principles" },
  { href: "#workflow", label: "Framework" },
  { href: "#impact", label: "Impact" },
];

const METRICS = [
  {
    icon: Factory,
    value: 1.48,
    decimals: 2,
    unit: "M",
    suffix: "tCO₂e",
    label: "Scope 1 & 2 GHG under continuous monitor",
    trend: "8.4% intensity YoY",
    trendIcon: TrendingDown,
    tone: "gold",
  },
  {
    icon: Zap,
    value: 42.8,
    decimals: 1,
    unit: "%",
    suffix: "",
    label: "Renewable share of the group energy mix",
    trend: "+6.2% clean power",
    trendIcon: TrendingUp,
    tone: "teal",
  },
  {
    icon: Droplets,
    value: 68.5,
    decimals: 1,
    unit: "%",
    suffix: "",
    label: "Water recycled and reused across operations",
    trend: "Zero liquid discharge",
    trendIcon: BadgeCheck,
    tone: "green",
  },
  {
    icon: HardHat,
    value: 52.4,
    decimals: 1,
    unit: "M",
    suffix: "hrs",
    label: "Safe workhours logged group-wide",
    trend: "Zero fatal incidents",
    trendIcon: ShieldCheck,
    tone: "green",
  },
  {
    icon: Radar,
    value: 200,
    decimals: 0,
    unit: "+",
    suffix: "",
    label: "Project sites reporting into one ledger",
    trend: "BRSR Core assured",
    trendIcon: BadgeCheck,
    tone: "gold",
  },
];

const FRAMEWORKS = [
  "SEBI BRSR Core",
  "NGRBC Principles",
  "GHG Protocol",
  "ISO 14064",
  "GRI Standards",
  "CEA Emission Factors",
  "CPCB · SPCB",
  "XBRL Filing",
  "Integrated Reporting",
  "Business Responsibility",
];

const PILLARS = [
  {
    accent: "people",
    num: "01",
    icon: Users,
    name: "People",
    desc: "The fifty thousand hands that build India — their safety, welfare and growth, tracked to the individual and reported to the board.",
    modules: [
      "Zero lost-time injury programme",
      "Workforce demographics & gender parity",
      "Fair wages & human-rights diligence",
      "Verified technical training hours",
    ],
  },
  {
    accent: "planet",
    num: "02",
    icon: Leaf,
    name: "Planet",
    desc: "Every tonne accounted for. Emissions, water and waste measured at source with statutory emission factors — never estimated after the fact.",
    modules: [
      "Scope 1–3 GHG · CEA & IPCC factors",
      "Renewable energy mix, solar & hydro",
      "Water recycling, zero liquid discharge",
      "Waste circularity & CPCB compliance",
    ],
  },
  {
    accent: "purpose",
    num: "03",
    icon: Compass,
    name: "Purpose",
    desc: "Nation-building is the business model. Community impact is engineered into the project, not annexed to the annual report.",
    modules: [
      "Strategic national infrastructure",
      "Rural healthcare & education CSR",
      "Structured grievance redressal",
      "UN SDG-aligned stakeholder dialogue",
    ],
  },
  {
    accent: "prosperity",
    num: "04",
    icon: TrendingUp,
    name: "Prosperity",
    desc: "Value that compounds without a debt to the planet — green supply chains and assets engineered to outlast their builders.",
    modules: [
      "Vendor ESG diligence & green sourcing",
      "Sustainable capital allocation",
      "Asset durability & build quality",
      "Clean mobility & e-transit manufacturing",
    ],
  },
  {
    accent: "principles",
    num: "05",
    icon: Scale,
    name: "Principles",
    desc: "Governance you can audit. Every number carries a name, a timestamp and an approval trail that ends at the boardroom.",
    modules: [
      "Board oversight & ESG committee",
      "Anti-corruption code of conduct",
      "BRSR Core reporting & XBRL filing",
      "Cyber defence & data privacy",
    ],
  },
];

const PRINCIPLES = [
  { n: "P1", tag: "Governance", title: "Ethics, Transparency & Accountability", sum: "Zero tolerance for corruption, transparent disclosures and director oversight on every material matter." },
  { n: "P2", tag: "Stewardship", title: "Sustainable Goods & Services", sum: "Life-cycle assessment and resource efficiency engineered into every asset we deliver." },
  { n: "P3", tag: "Social", title: "Employee Well-being & Safety", sum: "Occupational health, safe remote sites, equal opportunity and continuous skill building." },
  { n: "P4", tag: "Stakeholders", title: "Stakeholder Engagement", sum: "Structured dialogue with communities, authorities, investors and vulnerable groups." },
  { n: "P5", tag: "Human Rights", title: "Promotion of Human Rights", sum: "Fair wages, no child labour and freedom of association across every vendor tier." },
  { n: "P6", tag: "Environment", title: "Environmental Protection", sum: "Emission mitigation, biodiversity stewardship and circular economy in daily practice." },
  { n: "P7", tag: "Public Policy", title: "Responsible Public Advocacy", sum: "Constructive participation in industry associations and green policy dialogues." },
  { n: "P8", tag: "Inclusive Growth", title: "Inclusive Development & CSR", sum: "Healthcare access, schools and rural infrastructure under targeted community programmes." },
  { n: "P9", tag: "Consumer Value", title: "Consumer Value & Redressal", sum: "Infrastructure quality, data privacy and cyber security with grievance closure that sticks." },
];

const FLOW_STEPS = [
  {
    num: "i",
    title: "Field Ingestion",
    desc: "Meter readings, diesel logs and water invoices enter with evidence documents attached at the point of capture.",
    role: "Site ESG Officer",
  },
  {
    num: "ii",
    title: "Engine Review",
    desc: "The calculation engine applies verified CEA and IPCC factors; business-unit managers confirm completeness.",
    role: "BU Reviewer",
  },
  {
    num: "iii",
    title: "Subsidiary Scrutiny",
    desc: "Figures are tested against targets, permits cross-checked, and approvals recorded with signed remarks.",
    role: "Subsidiary ESG Lead",
  },
  {
    num: "iv",
    title: "Group Consolidation",
    desc: "The group ledger is locked for the financial year and exported as standardized SEBI BRSR disclosures.",
    role: "Group ESG Head · CIO",
  },
];

const IMPACT_CHIPS = [
  { icon: Leaf, tone: "gold", val: "480,000+", label: "tCO₂e emissions avoided" },
  { icon: Droplets, tone: "teal", val: "8.4 bn L", label: "Industrial water recycled" },
  { icon: HeartHandshake, tone: "green", val: "500,000+", label: "Community beneficiaries" },
  { icon: HardHat, tone: "gold", val: "52.4 mn", label: "Zero-LTI safe manhours" },
];

const PROJECTS = [
  {
    img: "/project-zojila.jpg",
    alt: "Tunnel portal carved into the snow-bound Himalayas at Zojila pass",
    loc: "Sonamarg → Minamarg · J&K",
    index: "01",
    name: "Zojila Strategic Tunnel",
    tagline: "14.15 km all-weather Himalayan corridor",
    stats: [
      { k: "Travel time cut", v: "−3.5 hours" },
      { k: "Carbon abatement", v: "−42,000 tCO₂e" },
    ],
    narrative:
      "Retires the most hazardous pass on the Indian road network. Fewer idling engines below 3,500 metres, fewer convoys stranded by avalanche — and an unbroken lifeline to Ladakh through the deepest winters.",
    progress: { label: "Excavation & lining", value: "86% complete", bar: 86, tone: "" },
  },
  {
    img: "/project-solar.jpg",
    alt: "Endless rows of photovoltaic panels at the Charanka solar park at golden hour",
    loc: "Patan District · Gujarat",
    index: "02",
    name: "Charanka 250 MW Solar Park",
    tagline: "Utility-scale desert photovoltaics",
    stats: [
      { k: "Annual clean energy", v: "380,000 MWh" },
      { k: "Offset against coal", v: "−310,000 tCO₂e" },
    ],
    narrative:
      "Feeds the western regional grid from an arid landscape, with robotic dry-cleaning arrays that cut module water consumption by ninety percent — power purchased, not apologised for.",
    progress: { label: "Power purchase agreement", value: "102% of target", bar: 100, tone: "project-bar-fill--green" },
  },
  {
    img: "/project-irrigation.jpg",
    alt: "Lift irrigation pump station with steel penstocks beside a river canal",
    loc: "Godavari Basin · Telangana & AP",
    index: "03",
    name: "Kaleshwaram Lift Irrigation",
    tagline: "The world's largest multi-stage lift scheme",
    stats: [
      { k: "Command area", v: "18.2 lakh acres" },
      { k: "Villages supplied", v: "500+" },
    ],
    narrative:
      "Flood water lifted across the Deccan to recharge dry uplands — the regional water table up 3.2 metres, drinking security for five hundred villages, food security for a generation of farmers.",
    progress: { label: "Pumping reliability", value: "99.4% operational", bar: 99.4, tone: "project-bar-fill--teal" },
  },
  {
    img: "/project-evbus.jpg",
    alt: "Electric city buses charging at a modern depot at dusk",
    loc: "Pan-India Municipal Transit",
    index: "04",
    name: "Olectra e-Bus Fleet",
    tagline: "10,000 electric buses under deployment",
    stats: [
      { k: "Diesel displaced", v: "150M+ litres" },
      { k: "Tailpipe removed", v: "−400,000 tCO₂e" },
    ],
    narrative:
      "Silent, zero-emission mass transit across Delhi, Mumbai, Pune, Hyderabad and Surat — taking particulate matter out of the commute, one route at a time.",
    progress: { label: "Fleet deployment", value: "91% on schedule", bar: 91, tone: "project-bar-fill--ink" },
  },
];

const ROLES = [
  { icon: ShieldCheck, name: "Super Admin", mail: "admin@meil.in" },
  { icon: Clock3, name: "Group ESG Head", mail: "esg.head@meil.in" },
  { icon: Building2, name: "Zojila Project Director", mail: "pm.zojila@meil.in" },
  { icon: ClipboardList, name: "Site ESG Officer", mail: "esg.zojila@meil.in" },
];

/* ─────────────────────────────────────────────────────────────────────────
   Animated counter
   ───────────────────────────────────────────────────────────────────────── */

function Counter({ value, decimals }: { value: number; decimals: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [out, setOut] = useState(decimals > 0 ? (0).toFixed(decimals) : "0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1900;
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          setOut((value * eased).toFixed(decimals));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, decimals]);

  return <span ref={ref}>{out}</span>;
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────────── */

export default function LandingPage({
  onEnter,
  enterLabel,
}: {
  onEnter?: () => void;
  enterLabel?: string;
} ) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // reveal on scroll
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    // scroll state
    const sectionIds = ["home", "pillars", "brsr-framework", "workflow", "impact"];
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 30);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        progressRef.current.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
      }
      let current = "home";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 220) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="lp-root">
      <div className="lp-progress" ref={progressRef} aria-hidden />

      {/* ═══ NAVIGATION ═══ */}
      <header className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-shell">
          <div className="nav-bar">
            <a className="brand" href="#home" aria-label="MEIL Group home">
              <span className="brand-mark">M</span>
              <span className="brand-text">
                <b>MEIL Group</b>
                <small>BRSR &amp; ESG Intelligence</small>
              </span>
            </a>

            <nav className="nav-links" aria-label="Primary">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  className={`nav-link${active === l.href.slice(1) ? " active" : ""}`}
                  href={l.href}
                >
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="nav-cta-group">
              <button className="btn btn-gold" type="button" onClick={onEnter}>
                <span>{enterLabel ?? "Enter Platform"}</span>
                <ArrowRight className="btn-arrow" size={15} strokeWidth={2.4} />
              </button>
            </div>

            <button
              className="nav-burger"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>

          <nav
            className={`nav-mobile${menuOpen ? " open" : ""}`}
            aria-label="Mobile"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                className={active === l.href.slice(1) ? "active" : ""}
                href={l.href}
                onClick={() => setMenuOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <button
              className="btn btn-gold"
              type="button"
              style={{ marginTop: 10, justifyContent: "center" }}
              onClick={() => {
                setMenuOpen(false);
                onEnter?.();
              }}
            >
              <span>{enterLabel ?? "Enter Platform"}</span>
              <ArrowRight size={15} strokeWidth={2.4} />
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* ═══ HERO ═══ */}
        <section className="hero" id="home">
          <div className="hero-media">
            <img
              src="/meil_kaleshwaram_project.jpg"
              alt="Aerial view of the MEIL Kaleshwaram lift irrigation project and Medigadda barrage at dusk"
              fetchPriority="high"
            />
          </div>
          <div className="hero-veil" />
          <div className="aurora hero-aurora-1" />
          <div className="aurora hero-aurora-2" />

          <div className="hero-inner container-wide">
            <div className="hero-content">
              <p className="eyebrow eyebrow--paper hero-eyebrow" data-reveal>
                MEIL Group · Sustainability Intelligence · Since 1985
              </p>

              <h1 className="hero-title" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                The infrastructure of a nation,
                <br />
                <em>accountable</em> to its future.
              </h1>

              <p className="hero-lede" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                One platform where every megaproject, subsidiary and business unit
                reports sustainability the way we build — <strong>measured, verified
                and engineered to endure</strong>. Aligned to SEBI BRSR Core, the NGRBC
                nine principles and the GHG Protocol.
              </p>

              <div className="hero-ctas" data-reveal style={{ "--rd": "270ms" } as React.CSSProperties}>
                <button className="btn btn-gold btn-lg" type="button" onClick={onEnter}>
                  <span>{enterLabel ?? "Enter the Platform"}</span>
                  <ArrowRight className="btn-arrow" size={17} strokeWidth={2.4} />
                </button>
                <a className="btn btn-glass btn-lg" href="#brsr-framework">
                  <span>Explore the Principles</span>
                  <ArrowUpRight size={16} strokeWidth={2.2} />
                </a>
              </div>

              <ul className="hero-trust" data-reveal style={{ "--rd": "360ms" } as React.CSSProperties}>
                {[
                  "SEBI BRSR Core assured",
                  "GHG Protocol Scope 1·2·3",
                  "ISO 14064 aligned",
                  "CEA emission factors v2.4",
                ].map((t) => (
                  <li key={t} className="trust-chip">
                    <BadgeCheck size={13} strokeWidth={2.2} />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="hero-cue" aria-hidden>
            <span>Scroll</span>
            <div className="hero-cue-line" />
          </div>
        </section>

        {/* ═══ METRICS BAND ═══ */}
        <div className="metrics-band container-wide">
          <div className="metrics-card glass-dark glass-edge noise" data-reveal="scale">
            <div className="metrics-grid">
              {METRICS.map((m) => (
                <div className="metric" key={m.label}>
                  <div className="metric-top">
                    <span className={`metric-ico metric-ico--${m.tone}`}>
                      <m.icon size={18} strokeWidth={2} />
                    </span>
                  </div>
                  <span className="metric-num">
                    <Counter value={m.value} decimals={m.decimals} />
                    {m.unit}
                    {m.suffix ? <small>{m.suffix}</small> : null}
                  </span>
                  <span className="metric-label">{m.label}</span>
                  <span className={`metric-trend metric-trend--${m.tone}`}>
                    <m.trendIcon size={11} strokeWidth={2.4} />
                    {m.trend}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ FRAMEWORK MARQUEE ═══ */}
        <div className="marquee-band" style={{ marginTop: 26 }}>
          <div className="marquee-track" aria-hidden>
            {[...FRAMEWORKS, ...FRAMEWORKS].map((f, i) => (
              <span className="marquee-item" key={`${f}-${i}`}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ═══ FIVE PILLARS ═══ */}
        <section className="pillars-section section" id="pillars">
          <div className="aurora aurora-a" />
          <div className="aurora aurora-b" />

          <div className="container-wide">
            <div className="section-head">
              <span className="eyebrow eyebrow--paper eyebrow--center" data-reveal>
                The 5P Framework
              </span>
              <h2 className="section-title section-title--paper" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                Five pillars, one <em>chain of custody</em>.
              </h2>
              <p className="section-sub section-sub--paper" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                From a meter reading at a Himalayan tunnel head to a signed SEBI
                disclosure — every indicator is captured with source evidence,
                calculated with statutory factors and approved through four tiers
                of scrutiny.
              </p>
            </div>

            <div className="pillar-grid">
              {PILLARS.map((p, i) => (
                <article
                  className="pillar-card glass-dark glass-edge sweep"
                  data-accent={p.accent}
                  key={p.name}
                  data-reveal
                  style={{ "--rd": `${i * 90}ms` } as React.CSSProperties}
                >
                  <span className="pillar-ghost">{p.num}</span>
                  <span className="pillar-icon">
                    <p.icon size={24} strokeWidth={1.9} />
                  </span>
                  <span className="pillar-kicker">Pillar {p.num}</span>
                  <h3 className="pillar-name">{p.name}</h3>
                  <p className="pillar-desc">{p.desc}</p>
                  <ul className="pillar-list">
                    {p.modules.map((m) => (
                      <li key={m}>
                        <BadgeCheck size={14} strokeWidth={2.2} />
                        {m}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ BRSR MATRIX ═══ */}
        <section className="brsr-section section" id="brsr-framework">
          <div className="container-wide">
            <div className="section-head">
              <span className="eyebrow eyebrow--ink eyebrow--center" data-reveal>
                SEBI-Mandated · NGRBC
              </span>
              <h2 className="section-title" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                Nine principles, mapped <em>to the letter</em>.
              </h2>
              <p className="section-sub" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                Every indicator in the platform is traced to the National
                Guidelines for Responsible Business Conduct — so a disclosure is
                never an interpretation.
              </p>
            </div>

            <div className="matrix" data-reveal="scale">
              {PRINCIPLES.map((p) => (
                <div className="matrix-cell" key={p.n}>
                  <div className="matrix-head">
                    <span className="matrix-num">{p.n}</span>
                    <span className="matrix-tag">{p.tag}</span>
                  </div>
                  <h3 className="matrix-title">{p.title}</h3>
                  <p className="matrix-sum">{p.sum}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ WORKFLOW ═══ */}
        <section className="workflow-section section" id="workflow">
          <div className="container-wide">
            <div className="section-head">
              <span className="eyebrow eyebrow--paper eyebrow--center" data-reveal>
                Governance in Action
              </span>
              <h2 className="section-title section-title--paper" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                Four tiers from field <em>to filing</em>.
              </h2>
              <p className="section-sub section-sub--paper" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                Spreadsheets do not survive an audit. Every figure moves through a
                traceable chain of custody — with evidence attached at the point
                of entry.
              </p>
            </div>

            <ol className="flow-rail">
              {FLOW_STEPS.map((s, i) => (
                <li className="flow-step" key={s.title} data-reveal style={{ "--rd": `${i * 110}ms` } as React.CSSProperties}>
                  <span className="flow-node">{s.num}</span>
                  <div className="flow-card glass-dark glass-edge">
                    <h3 className="flow-title">{s.title}</h3>
                    <p className="flow-desc">{s.desc}</p>
                    <span className="flow-role">{s.role}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ IMPACT ═══ */}
        <section className="impact-section section" id="impact">
          <div className="container-wide">
            <div className="section-head">
              <span className="eyebrow eyebrow--ink eyebrow--center" data-reveal>
                Measured Outcomes
              </span>
              <h2 className="section-title" data-reveal style={{ "--rd": "90ms" } as React.CSSProperties}>
                Progress you can <em>audit</em>.
              </h2>
              <p className="section-sub" data-reveal style={{ "--rd": "180ms" } as React.CSSProperties}>
                Sustainability milestones across the group&rsquo;s flagship
                projects — restated with the same rigour we apply to a balance
                sheet.
              </p>
            </div>

            <div className="impact-strip">
              {IMPACT_CHIPS.map((c, i) => (
                <div
                  className="impact-chip glass-light"
                  key={c.label}
                  data-reveal
                  style={{ "--rd": `${i * 80}ms` } as React.CSSProperties}
                >
                  <span className={`impact-chip-ico impact-chip-ico--${c.tone}`}>
                    <c.icon size={21} strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className="impact-chip-val">{c.val}</span>
                    <span className="impact-chip-label">{c.label}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="impact-grid">
              {PROJECTS.map((p, i) => (
                <article
                  className="project-card"
                  key={p.name}
                  data-reveal
                  style={{ "--rd": `${(i % 2) * 110}ms` } as React.CSSProperties}
                >
                  <figure className="project-media">
                    <img src={p.img} alt={p.alt} loading="lazy" />
                    <span className="project-loc">
                      <MapPin size={11} strokeWidth={2.4} />
                      {p.loc}
                    </span>
                    <span className="project-index">{p.index}</span>
                  </figure>
                  <div className="project-body">
                    <h3 className="project-name">{p.name}</h3>
                    <p className="project-tagline">{p.tagline}</p>
                    <div className="project-stats">
                      {p.stats.map((s) => (
                        <div className="project-stat" key={s.k}>
                          <small>{s.k}</small>
                          <b>{s.v}</b>
                        </div>
                      ))}
                    </div>
                    <p className="project-narrative">{p.narrative}</p>
                    <div className="project-progress">
                      <div className="project-progress-labels">
                        <span>{p.progress.label}</span>
                        <span>{p.progress.value}</span>
                      </div>
                      <div className="project-bar">
                        <div
                          className={`project-bar-fill ${p.progress.tone}`}
                          style={{ "--bar": `${Math.min(p.progress.bar, 100)}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ ACCESS CTA ═══ */}
        <section className="access-section">
          <div className="container-wide">
            <div className="access-panel noise" data-reveal="scale">
              <div className="aurora aurora-a" />
              <div className="aurora aurora-b" />

              <div className="access-content">
                <div data-reveal="left">
                  <span className="eyebrow eyebrow--paper">Role-Based Access</span>
                  <h2 className="access-title">
                    Step inside the <em>reporting room</em>.
                  </h2>
                  <p className="access-sub">
                    Walk the platform with pre-configured executive, manager and
                    auditor profiles — switch roles and watch the same ledger
                    reshape itself for each responsibility.
                  </p>
                  <button className="btn btn-gold btn-lg" type="button" onClick={onEnter}>
                    <span>{enterLabel ?? "Login to Platform"}</span>
                    <ArrowRight className="btn-arrow" size={17} strokeWidth={2.4} />
                  </button>
                  <p className="access-note">
                    <LockKeyhole size={12} strokeWidth={2.2} />
                    Encrypted session · SSO-ready · Audit logged
                  </p>
                </div>

                <div className="role-list" data-reveal="right">
                  {ROLES.map((r) => (
                    <button className="role-chip" type="button" key={r.name} onClick={onEnter}>
                      <span className="role-ico">
                        <r.icon size={18} strokeWidth={1.9} />
                      </span>
                      <span>
                        <span className="role-name">{r.name}</span>
                        <span className="role-mail">{r.mail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="container-wide">
          <div className="footer-top">
            <div className="footer-brand">
              <a className="brand" href="#home" aria-label="MEIL Group home">
                <span className="brand-mark">M</span>
                <span className="brand-text">
                  <b>MEIL Group</b>
                  <small>BRSR &amp; ESG Intelligence</small>
                </span>
              </a>
              <p>
                Megha Engineering &amp; Infrastructures Limited — building
                India&rsquo;s critical infrastructure since 1985, and accounting
                for every megawatt, litre and lifehour in the open.
              </p>
            </div>

            <div className="footer-col">
              <h4>Frameworks</h4>
              <ul className="footer-links">
                <li><a href="#brsr-framework">SEBI BRSR Core</a></li>
                <li><a href="#brsr-framework">NGRBC Nine Principles</a></li>
                <li><a href="#pillars">GHG Protocol Scope 1–3</a></li>
                <li><a href="#pillars">CEA Emission Factors</a></li>
                <li><a href="#pillars">CPCB · SPCB Compliance</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Flagships</h4>
              <ul className="footer-links">
                <li><a href="#impact">Zojila Strategic Tunnel</a></li>
                <li><a href="#impact">Kaleshwaram Lift Irrigation</a></li>
                <li><a href="#impact">Polavaram Project</a></li>
                <li><a href="#impact">Charanka Solar Park</a></li>
                <li><a href="#impact">Olectra e-Mobility</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Portal</h4>
              <div className="footer-status">
                <div className="footer-status-row">
                  <span className="pulse-dot" />
                  Reporting portal active
                </div>
                <p>
                  Centralised ESG consolidation for MEIL subsidiaries, business
                  units and project sites. FY 2025–26 collection in progress.
                </p>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Megha Engineering &amp;
              Infrastructures Limited. All rights reserved.
            </span>
            <div className="footer-legal">
              <a href="#home">Privacy</a>
              <a href="#home">Terms</a>
              <a href="#home">Information Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
