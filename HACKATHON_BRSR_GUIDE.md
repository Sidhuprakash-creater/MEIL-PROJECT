# 🏆 MEIL BRSR Report — Pura Guide (Hackathon Demo)

> **Goal:** Platform se start-to-end chal kar ek **final BRSR PDF report** nikalna.
> Sab kuch system ke andar se aayega — koi bahar ka data nahi.

---

## 📊 Ek Nazar Me Flow

```
Contributor (data bharta hai)
        ↓
Project Admin (approve karta hai)
        ↓
Project Admin → Consolidated Dossier (ek single package) → BU ko bhejta hai
        ↓
BU Manager (dossier approve / reject-return with remarks)
        ↓
Subsidiary Manager (usi dossier ko approve karta hai — ek-ek item nahi)
        ↓
Subsidiary Admin → "Submit Final Report to Group" button
        ↓
Group Admin → BRSR Data Checklist (verify) → BRSR Wizard (Recompute)
        → Sign-off → Finalize → PDF Export ✅
```

---

## 🟢 PART 0 — Setup Check (Demo se pehle 5 min)

1. Project ko chalao (`npm run dev`)
2. Login karo kisi bhi role se — sab kaam kar raha hai na, confirm karo
3. Ye cheezein already ready hain (maine pre-fill ki hain):
   - ✅ 22 submissions (20 APPROVED + 2 SUBMITTED — live demo ke liye)
   - ✅ 7 subsidiaries ke BRSR Data forms (draft me bhare hue)
   - ✅ Group BRSR report `BRSR-2025-RL0QF` (24 disclosures + 8 sections, SIGNOFF step par)

**Agar kabhi data dobara bharna ho** (naya browser/db ho to):
```bash
npx tsx scripts/seed-hackathon-flow.ts   # 22 real submissions (2 live demo ke liye pending)
npx tsx scripts/seed-brsr-data.ts        # 7 subsidiaries ke BRSR forms
npx tsx scripts/seed-brsr-report.ts      # Group BRSR report pre-filled
```

---

## 🟡 PART 1 — Data Flow Live Demo (Contributor → Group tak)

### Step 1 — Contributor: Data Submit karna
**Login:** koi contributor (jaise *Ramesh Iyer — ENV_DATA_USER*)

1. Sidebar → **Data Collection / My Tasks**
2. Apni disclosure kholo → values bharo → evidence attach karo
3. **Submit** daba do
4. Status: `DRAFT → SUBMITTED` ho jayega

> 💡 Demo me sirf 1-2 form live bharna kaafi hai — baaki 20 already approved hain.

### Step 2 — Project Admin: Approve karna
**Login:** Project Admin (project-level)

1. **Submissions / Data Collection Status** view kholo
2. Pending disclosures dikhengi — **2 compliance wali** (`SUB-9L63-021`, `SUB-9L63-022`) 👈 *ye live approve karo*
3. Review karo → remark optional → **Approve**
4. Status: `SUBMITTED → APPROVED`

> 🎤 Demo line: *"Contributor ne data submit kiya, Project Admin ne verify karke approve kiya."*

### Step 3 — Project Admin: Consolidated Report banana
Abhi bhi Project Admin ke paas hi raho:

1. **Consolidated Report** view kholo
2. Saari approved disclosures yahan staged dikhengi (module-wise grouped)
3. Steps follow karo (info → review → submit) → last tab me **Submit to BU Manager**
4. **Sirf EK dossier** jayega BU ke paas (individual nahi) ✅

> 🎤 Demo line: *"Project Admin sab disclosures ko consolidate karke EK dossier bhejta hai — BU ko 10-10 alag report nahi jaati."*

### Step 4 — BU Manager: Dossier Approve
**Login:** BU Manager

1. **Queue** me ek hi Consolidated Dossier dikhega
2. Dossier kholo → saari disclosures + evidence + values andar hain
3. **Approve** dabao
   - (Reject/Return bhi kar sakte ho — remark min 10 chars mandatory, wapas PA ke paas chala jayega — ye bhi dikha sakte ho!)
4. Dossier ki saari disclosures `BU_APPROVED` ho jayengi ✅

### Step 5 — Subsidiary Manager: Ek Hi Approval
**Login:** Subsidiary Manager

1. Queue me wahi consolidated dossier aayega (individual items hidden)
2. **Approve** karo
3. Isi se subsidiary ka pura data approved maana jayega

### Step 6 — Subsidiary Admin: Final Report Group ko
**Login:** Subsidiary Admin

1. **ESG Reporting** view kholo
2. Hero section me **"Submit Final Report to Group"** button — ab **enabled** hoga
   (pehle locked tha — *"Locked until the consolidated data is approved"*)
3. Click → dialog → **Submit**
4. Group Admin ke paas reporting package pahunch gaya ✅

> 🎤 Demo line: *"BU se aaya consolidated data approve hote hi subsidiary Group ko final report submit kar payi — na ki har chhoti item approve karte hue."*

---

## 🔵 PART 2 — Group Admin: BRSR Report Banana

**Login:** Group Admin

### Step 7 — BRSR Data Checklist (Verify)
1. Sidebar → **BRSR Reporting** → **BRSR Data Checklist**
2. Dikhega: `Submitted: 7/7` — har subsidiary ka section-wise status (green/amber/gray)
3. Ye wo data hai jo policies, governance, workforce, methodology waghera cover karta hai

### Step 8 — BRSR Wizard me Real Values lao
1. **BRSR Reporting Center** kholo → report **`BRSR-2025-RL0QF`** kholo
2. Step tabs dikhte hain: Information ✓ → Scope ✓ → Consolidation ✓ → Mapping & Validation ✓ → Draft ✓ → **Builder** → Review & Sign-off → Finalize
3. **Step 4 (Mapping & Validation)** me → **Recompute** dabao
   - 👈 **Yahi real-time magic hai** — values **approved submissions se calculate** hoti hain
   - Scope 1, Scope 2, Energy, Water, Waste, Workforce, CSR, Procurement — sab aayega
4. Disclosures ab **VALIDATED** dikhengi (warnings gayab/hone chahiye)

> ⚠️ **Dhyan:** Step 5 ka **"Generate"** dobara MAT dabana — wo sections overwrite karta hai.
> Agar dab jaye to koi baat nahi — ab mapping fix hai, values ke saath hi generate hoga.

### Step 9 — Sign-off
1. **Review & Sign-off** tab par jao (wizard step 7)
2. Name field me apna naam → optional comment
3. **Record sign-off** → sign-off ledger me aa jayega

### Step 10 — Finalize & PDF Export 🎯
1. **Finalize & Export** tab (step 8)
2. Finalization requirements green check hone chahiye
3. **Finalize report** dabao → report `FINALIZED` lock ho jayegi
4. Format = **PDF** (default) → **Export & download**
5. Print preview khulega → print dialog me destination **"Save as PDF"** chuno
6. **PDF me kya milega:**
   - 📄 Cover page — MEIL GROUP, BRSR title, FY, boundary, version, prepared/reviewed by
   - 📊 Section 1 — narrative sections (executive summary, methodology...)
   - 📋 Section 2 — Disclosure Register (General/Environment/Social/Governance tables)
   - ✍️ Section 3 — Sign-offs
   - 📎 Section 4 — **7 subsidiaries ka pura BRSR Data annexure** (entity, workforce, policies, emission factors, sab kuch)

### Step 11 — (Bonus dikha sakte ho)
- **Export history** — kaun kab kya export kiya (audit ledger)
- **BRSR Data Checklist** wapas dikhao — sab green
- Consolidation view me lineage/validation bhi hai

---

## 🗝️ Demo Me Ye Bolne Ke Punch Lines

| Jab | Bolo |
|---|---|
| Data submit | "Har data point evidence ke saath aata hai — audit-ready" |
| PA approve | "Verification layer — galat data aage nahi jata" |
| Consolidated dossier | "Sirf ek consolidated package jaata hai BU ke paas — individual nahi" |
| BU reject-return dikha to | "Remarks ke saath correction loop — full traceability" |
| SM ek approval | "Ek-ek item approve nahi — consolidated sign-off" |
| SA button unlock | "Eligibility system decide karta hai, manual nahi" |
| Recompute | "BRSR values LIVE approved data se compute hoti hain — hardcoded nahi" |
| PDF export | "Final SEBI BRSR Core format — pura audit trail andar" |

---

## 🚨 Agar Kuch Gadbad Ho (Quick Fixes)

| Problem | Fix |
|---|---|
| Dossier BU ko nahi dikha | PA ne consolidated submit kiya? "Forward to BU" ab disabled hai — sirf consolidated jaata hai |
| Wizard step aage nahi ja raha | Tabs par click karke sidha jao; `wizardStep` DB me persist hai |
| Warnings "pending" dikhe | Step 4 Recompute dabao (mapping fix ho chuki hai) |
| Sections "value pending" likhe | Recompute karo; agar Step 5 Generate daba ho to ab values ke saath regen hoga |
| Subsidiary button locked | SM ne dossier approve kiya? Checklist: BU approved → SM approved → button unlock |
| Report list me meri report nahi | `BRSR-2025-RL0QF` dhoondo; na mile to `npx tsx scripts/seed-brsr-report.ts` chalao |
| PDF print dialog na khule | Popup blocker check karo — site allow karo |

---

## ✅ Final Checklist (Demo se 10 min pehle)

- [ ] Dev server chal raha hai
- [ ] 2 pending submissions hain (`SUB-9L63-021`, `-022`) — live approval ke liye
- [ ] 7 subsidiaries ke BRSR forms DRAFT me bhare hain
- [ ] Report `BRSR-2025-RL0QF` SIGNOFF step par hai
- [ ] Ek dummy run: Recompute → Sign-off tak ek baar ghar par karke dekho
- [ ] Popup blocker allow (PDF ke liye)

**Bas — ab pura flow tumhare control me hai. All the best! 🚀**
