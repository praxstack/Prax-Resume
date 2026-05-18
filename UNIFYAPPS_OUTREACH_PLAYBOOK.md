# UnifyApps Sr. FDSE — Outreach Playbook

> **Goal:** get a recruiter screen for **Sr. Forward-Deployed Software Engineer** at UnifyApps without being blocked by their Google Form's `Year of Graduation` dropdown (2023/2024/2025 only — you graduated 2022).
>
> **Strategy:** dual-track. (A) Submit the form correctly, knowing it'll likely silently filter you. (B) In parallel, **referral path is your real shot.** Build it now.

---

## 0 · Honest Read of the Form

| Field | Your answer | Risk |
|---|---|---|
| College | **NIT** | ✅ explicitly listed, you're fine |
| Year of Graduation | **No 2022 option** | 🔴 the trap |
| Role | **Forward Deployed Software Engineer (FDSE) / Sr. FDSE** | ✅ correct lane |
| Public resume link | needs hosting | ⚠️ fix before submitting |
| Preferred Location | Gurgaon or Mumbai | ✅ either is fine |

### About the year dropdown — DO NOT pick "2025"
- It's misrepresentation. If they figure it out (and they will, your Amazon dates are public on LinkedIn), the application becomes evidence of dishonesty. Not worth the risk.
- Two clean alternatives:
  1. **Skip the form. Apply via referral only.** *(Recommended — see §3.)*
  2. **Apply via form AND referral.** Pick the closest year, **2023**, and explicitly call it out in the cover note (*"Form's grad-year dropdown didn't include 2022 — I selected 2023, which is when I converted intern → FTE start; please flag if this is an issue."*) — owns the discrepancy upfront. Lower-risk than picking 2025; recruiter sees an honest applicant who read carefully.

> **My pick:** option 2. Submit the form (tracked, dated, in their system) **and** referral path (real path through). Both ride.

---

## 1 · Pre-Apply Checklist (Do These Today, Before Any Outreach)

### 1.1 Host your resume publicly
GitHub Pages is the cleanest path. From the repo root:

```sh
# 1. ensure the file is committed
git add "Prakhar — UnifyApps FDSE.html"
git commit -m "Add UnifyApps FDSE-tailored resume"
git push origin main

# 2. enable GitHub Pages
#    Repo → Settings → Pages → Source: "Deploy from a branch", Branch: main, Folder: /(root)

# 3. your URL becomes:
#    https://praxstack.github.io/Prax-Resume/Prakhar%20%E2%80%94%20UnifyApps%20FDSE.html

# 4. (optional) generate the PDF and host that too
npm run pdf -- "Prakhar — UnifyApps FDSE.html" "Prakhar — UnifyApps FDSE.pdf"
git add "Prakhar — UnifyApps FDSE.pdf" && git commit -m "PDF" && git push
```

**Use the `.html` URL in the form** (Google form says "Resume" but accepts any link — HTML is faster to load on mobile, recruiter-friendly). Have the PDF as a backup.

### 1.2 Update your LinkedIn (15 min)
Recruiters will check before clicking your form submission.
- **Headline:** `Forward-Deployed Software Engineer · Java + Spring Boot · ex-Amazon (Travel) · Building agentic AI in Java`
- **About:** first 2 lines must include "Java", "Spring Boot", "API integrations", and "agentic AI" — those are UnifyApps' keyword filter words
- **Featured:** pin your Redis-from-scratch repo and (in 2 weeks) the agentic workflow repo
- **Open To Work:** turn on "recruiters only" with target = "Forward Deployed Engineer", "Solutions Engineer", "Software Engineer", India

### 1.3 Refresh your GitHub profile
- Pin: `redis-server-java`, `agentic-workflow-java` (when ready), `markdown-viewer-pro`
- README.md on `praxstack/praxstack` (profile repo): one-paragraph intro, "currently building", contact

---

## 2 · Form Submission Plan

Submit the form **AFTER** you've done §1.1–1.3 and lined up at least one referral DM (§3). Order matters — the referral hits the recruiter the same day, while your form submission lands in the queue.

**Field-by-field:**
- Email → `prax.sr.sde@gmail.com` *(use this; it's already in the form context)*
- Full Name → Prakhar Shekhar Parthasarthi
- Phone → your number
- College → **NIT**
- Year of Graduation → **2023** *(closest to truth; you finished MCA July 2022 and converted to full-time at Amazon shortly after — the "experience year" framing applies)*
- LinkedIn URL → your profile
- Resume → GitHub Pages link from §1.1 (verify the link works in incognito — *"Ensure access is public"* is in the form)
- Preferred Location → **Gurgaon** *(NCR is the bigger UnifyApps office; more roles)*
- Role → **Forward Deployed Software Engineer (FDSE) / Sr. FDSE**

---

## 3 · The Referral Path (Your Real Shot)

### 3.1 Find 3-5 UnifyApps insiders to DM

**Search LinkedIn for these profile types**, in priority order:
1. **Recruiters / TA at UnifyApps** — search `"UnifyApps" recruiter` or `"UnifyApps" "talent"`
2. **Engineering managers / EMs** — search `"UnifyApps" engineering manager`
3. **Forward-Deployed Engineers / Solutions** — search `"UnifyApps" "forward deployed"` or `"UnifyApps" solutions`
4. **Founder / co-founders** — Pavitar Singh (CEO), look up the leadership page
5. **Amazon overlap** — search `UnifyApps` filtered by `past company: Amazon` — **highest hit rate**, you share war stories

Aim for **3 sends in the first 24h, 5 by end of week 1.**

### 3.2 The Cold-DM Templates

**Three variants — match the recipient:**

---

**A · To a Recruiter / TA at UnifyApps** *(highest priority, send first)*

> Subject: Sr. FDSE candidate — ex-Amazon, Java + agentic AI in flight
>
> Hi [Name],
>
> Saw the Sr. FDSE hiring drive — I'd be a good fit and wanted to put myself on your radar directly.
>
> 3+ years at Amazon (Travel) shipping Java/Spring Boot services and integrating 6 partner APIs. p90 cut 47%, conversion +33%. Built a RESP2 Redis server from scratch in Java for fun (154k SET / 195k GET rps). Currently building a Java + Spring AI agentic workflow engine — first-principles, idempotency keys, audit logs, human-approval gate (the FDSE shape of work).
>
> One note: your form's grad-year dropdown only goes back to 2023. I graduated MCA from MNNIT 2022. Wanted to flag honestly so it doesn't slip through a filter.
>
> 60-second resume: [GitHub Pages link]
> Repo: github.com/praxstack/redis-server-java
>
> Worth a 15-min screen?
>
> Prakhar

---

**B · To an Engineer or EM (Amazon-overlap preferred)**

> Hi [Name],
>
> Noticed you went from Amazon → UnifyApps. I'm in the same boat thinking — 3 years at Amazon Travel (Hotels/Flights) on Java/Spring services, looking at the Sr. FDSE role at UnifyApps.
>
> Two questions if you have a minute:
> 1. What's the actual day-to-day rhythm look like? "60-day go-live" sounds intense but honest take?
> 2. Is there a referral channel? Form's grad-year dropdown stops at 2023 (I'm 2022 MCA), worried I'll get filtered.
>
> Happy to share what I've been building — Java agentic workflow engine in flight, Redis-from-scratch repo done. ex-Amazon-to-ex-Amazon, no sales pitch.
>
> Resume if useful: [link]
>
> Cheers,
> Prakhar

---

**C · To a Founder / Sr. leader** *(short, no ask in DM 1)*

> Hi Pavitar,
>
> The LinkedIn post on the 60-day go-live cadence resonated. Different shape of work from the 6-month-PRD culture I came out of (3 years at Amazon Travel — Java/Spring, idempotent integrations, ex-Amazon Pay).
>
> Currently building a Java + Spring AI agentic workflow engine — agentic loop, idempotency keys, audit log, human-approval gate. Will share when it's live in 2 weeks.
>
> Big fan of the bet. If there's a fit on the Sr. FDSE side, I'd love to chat.
>
> Prakhar
> [LinkedIn] · [GitHub]

---

### 3.3 Follow-Up Cadence
- Day 0 — send DM
- Day 4 — soft bump *("hi [name], floating this back up — happy to send a 2-min Loom of the Java agentic engine if useful")*
- Day 10 — final bump only if engaged before *("not chasing, just want to close the loop — best path forward?")*
- After Day 10 with no reply → move on, try the next person on the list. **Do not double-bump unanswered messages.**

---

## 4 · Cover Note — paste into form's "anything else?" field if there is one, OR send as email body if you find a recruiter address

> Sr. FDSE / UnifyApps — Prakhar Shekhar Parthasarthi
>
> Why FDSE, why UnifyApps:
> The 60-day go-live cadence is the inverse of where I came from (3 years at Amazon Travel — services owned end-to-end, but with quarterly planning cycles around them). I want to compress the loop.
>
> What I bring:
> · 3+ yrs Java / Spring Boot / AWS, owned 4 microservices end-to-end
> · 6 partner-API integrations in production; idempotent webhook design (43 bps CPT impact)
> · Resolved 150+ prod incidents, authored COEs presented to leadership — comfortable in cross-functional rooms
> · Built RESP2 Redis server from scratch in Java (154k/195k rps) — won't hide behind frameworks
> · Currently shipping a Java + Spring AI agentic workflow engine — natural language → tool-calling loop with idempotency, audit log, human-approval gate. Public repo + 2-min Loom in ~14 days.
>
> One honest note:
> Form's grad-year dropdown didn't include 2022 (my MCA at MNNIT was 2019–2022; I joined Amazon FT shortly after). I selected 2023 to closest reflect the start-of-experience year — please flag if this matters; happy to clarify on a screen.
>
> Open to relocate to Gurgaon (preference) or Mumbai. Fastest reach: prax.sr.sde@gmail.com
>
> Resume: [link]
> Code: github.com/praxstack

---

## 5 · Interview Prep (in case the screen happens fast)

If the recruiter responds within 48h, you might get a screen before the agentic project ships. Prepare answers anyway:

### "Walk me through your Amazon work"
60 seconds. Lead with **scope** (4 services, owned end-to-end), then **one number** (47% p90 cut), then **one judgment call** (idempotency design on the schedule-change webhook — *"because at-least-once delivery + retries means dedup keys in DynamoDB are non-negotiable"*).

### "Why FDSE?"
*"I want the customer-feedback loop tight. At Amazon I owned services but didn't talk to the people who used them. FDSE is the inverse — the customer is in the room, the integration is the project, the success metric is whether they're live in 60 days. That's a much better feedback loop for a builder."*

### "What's your take on agentic AI in enterprise?"
*"The demos are easy, the reliability is hard. The interesting problems are: how do you make a tool call idempotent so the agent doesn't double-charge a customer? How do you persist enough state that a crashed agent run can resume? What's the human-approval contract for actions that touch external systems? I'm building a Java engine right now exactly to get hands-on with these."*

### "Why didn't you continue at Amazon?"
*(Sep 2025 end date — be ready.)* Honest, short, forward-looking. Don't trash Amazon. Pick **one** real reason: *"I wanted to compress the build-ship-feedback loop. Amazon's bar is high but the loop is long. UnifyApps' 60-day cadence is what I want to optimize my next 2 years for."*

### "What's a project you're most proud of?"
The Redis server. *"~~Scratched my own itch~~ Wanted to know how Redis actually worked, so I built RESP2 from scratch in Java. 154k rps SET, 195k rps GET, 42 tests at 100%. The interesting thing was the TTL-eviction design — hybrid lazy-on-GET plus active-sweep — because pure-active eats CPU and pure-lazy leaks memory. Trade-offs are everything."*

### "Your weakness?"
Don't say "perfectionism." Say something true and small: *"I default to deep technical work over visible communication. At Amazon I'd ship a fix and forget to broadcast it. I've been forcing myself to write things up and present even small wins — the COE habit was step one."*

---

## 6 · 14-Day Execution Schedule (Day 0 = today)

| Day | Action | Effort |
|---|---|---|
| **0 (today)** | Host resume on GitHub Pages. Verify link in incognito. Update LinkedIn headline + Open To Work. Pin GitHub repos. | 90 min |
| **1** | Find 5 UnifyApps targets on LinkedIn. Send 2 DMs (Recruiter + ex-Amazon engineer). | 60 min |
| **2** | Submit the Google form (with §2 plan + §4 cover note). Send 1 more DM. | 45 min |
| **3** | Start the agentic project (see `UNIFYAPPS_GENAI_PROJECT_SPEC.md`). | 5h |
| **4–13** | Build agentic project per spec. Day 4 bump on stale DMs. | 5h/day |
| **14** | Project shipped. LinkedIn launch post. Loom in resume. Send Loom + repo link to anyone who replied earlier — "promised I'd send this when it was live." | 3h |

---

## 7 · What Success Looks Like

- ✅ Form submitted with honest answers
- ✅ 3+ DMs sent, at least 1 reply by day 7
- ✅ Recruiter screen scheduled by day 14
- ✅ Agentic project shipped public by day 14
- ✅ Loom + Redis repo links handed to recruiter on the screen

If by **day 21** there's no recruiter contact: the role isn't going to happen this cycle. Repurpose the artifacts (resume + agentic project + Loom) for the next 5 FDSE/Solutions Engineer roles — they all want the same signal.

---

## 8 · The One Thing You Cannot Fake

Everything else in this playbook is mechanics. The interview itself rewards one thing: **a candidate who has built something hard, recently, and can talk about the trade-offs without slides.**

You have the Redis server. You'll have the agentic engine. Walk in with both stories ready, and the form's grad-year dropdown won't matter.
