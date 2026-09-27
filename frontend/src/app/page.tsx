'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const chapters = [
  ['01','SOURCE','Text · PDF · Image · Video · Audio · Web'],
  ['02','UNDERSTAND','Entities · Claims · Events · Context'],
  ['03','VERIFY','Evidence · Conflicts · Uncertainty'],
  ['04','DECIDE','Audience · Channel · Urgency · Purpose'],
  ['05','TRANSFORM','Briefs · Advisory · Social · Presentation'],
  ['06','ADAPT','Changes · Versions · Living information'],
];

const outputs = ['LINKEDIN','X / THREAD','ADVISORY','EXECUTIVE SUMMARY','PRESENTATION','VIDEO','INFOGRAPHIC'];

export default function Home() {
  const [active, setActive] = useState('01');
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="cinemaSite">
      <div className="filmGrain" aria-hidden="true" />
      <div className="cursorGlow" style={{ transform: `translate3d(${Math.min(scrollY * 0.12, 90)}px, ${Math.min(scrollY * 0.05, 45)}px, 0)` }} />

      <section className="cinemaHero">
        <div className="heroAtmosphere" aria-hidden="true">
          <div className="sunCore" />
          <div className="heroGrid" />
          <div className="orbit orbitA" />
          <div className="orbit orbitB" />
          <div className="orbit orbitC" />
          <div className="signal signalOne" />
          <div className="signal signalTwo" />
          <div className="signal signalThree" />
        </div>

        <div className="cinemaHeader">
          <span>INFORGE / INFORMATION INTELLIGENCE</span>
          <span>BUILD 01 — 2026</span>
        </div>

        <div className="heroScene">
          <div className="heroCopy">
            <p className="heroKicker">EVERYTHING STARTS WITH A SOURCE.</p>
            <h1>UNDERSTAND<br /><em>BEFORE</em><br />YOU PUBLISH.</h1>
            <p className="heroLead">
              An intelligence layer that turns raw information into evidence-aware context,
              decision-ready communication and continuously updated action.
            </p>
            <div className="heroActions">
              <Link href="/engine" className="cinemaButton">ENTER THE ENGINE <span>↗</span></Link>
              <a href="#journey" className="ghostButton">TAKE THE JOURNEY ↓</a>
            </div>
          </div>

          <div className="heroArtifact" aria-hidden="true">
            <div className="artifactSky" />
            <div className="artifactSun" />
            <div className="artifactHorizon" />
            <div className="artifactRoad roadA" />
            <div className="artifactRoad roadB" />
            <div className="artifactNode nodeSource">SOURCE</div>
            <div className="artifactNode nodeEvidence">EVIDENCE</div>
            <div className="artifactNode nodeContext">CONTEXT</div>
            <div className="artifactCore">
              <span>AI</span>
              <small>INTELLIGENCE<br />LAYER</small>
            </div>
          </div>
        </div>

        <div className="heroBottom">
          <span>INFORMATION → INTELLIGENCE → ACTION</span>
          <span>SCROLL TO EXPLORE</span>
          <span>● SYSTEM ONLINE</span>
        </div>
      </section>

      <section className="manifesto" id="journey">
        <div className="sectionNumber">00 / THE PREMISE</div>
        <div className="manifestoGrid">
          <h2>THE OUTPUT<br />IS ONLY AS<br /><em>TRUSTWORTHY</em><br />AS THE CONTEXT.</h2>
          <div className="manifestoSide">
            <p>Most AI tools jump from input to output.</p>
            <p className="dim">INFORGE inserts an intelligence layer in between — claims, evidence, uncertainty, context and change.</p>
            <div className="movingRule"><span>UNDERSTAND</span><i>→</i><span>VERIFY</span><i>→</i><span>TRANSFORM</span></div>
          </div>
        </div>
      </section>

      <section className="chapterSection">
        <div className="chapterIntro">
          <div>
            <div className="sectionNumber">01 / THE INFORMATION JOURNEY</div>
            <h2>ONE SOURCE.<br /><em>SIX LAYERS.</em></h2>
          </div>
          <p>Scroll through the intelligence pipeline. Each layer changes what the system knows — and what it can responsibly communicate.</p>
        </div>

        <div className="chapterRail">
          {chapters.map(([num, title, desc]) => (
            <button
              key={num}
              className={`chapterCard ${active === num ? 'isActive' : ''}`}
              onMouseEnter={() => setActive(num)}
              onFocus={() => setActive(num)}
            >
              <span className="chapterNum">{num}</span>
              <div className="chapterVisual">
                <div className="miniOrbit" />
                <div className="miniCore">{num}</div>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <span className="chapterArrow">EXPLORE ↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="truthScene">
        <div className="truthBackdrop" aria-hidden="true">
          <div className="truthRing ring1" />
          <div className="truthRing ring2" />
          <div className="truthRing ring3" />
        </div>
        <div className="sectionNumber">02 / TRUTH LAYER</div>
        <div className="truthHeader">
          <h2>WHAT DO WE<br /><em>ACTUALLY KNOW?</em></h2>
          <p>INFORGE never hides uncertainty behind fluent language.</p>
        </div>
        <div className="truthStates">
          <article className="truthState knownState"><span>01</span><b>KNOWN</b><strong>VERIFIED</strong><p>Evidence-backed claims with source traceability and timestamps.</p></article>
          <article className="truthState unknownState"><span>02</span><b>UNKNOWN</b><strong>UNRESOLVED</strong><p>Missing evidence stays visible instead of being silently invented.</p></article>
          <article className="truthState conflictState"><span>03</span><b>CONFLICT</b><strong>CHANGING</strong><p>Contradictory or evolving facts become explicit decisions.</p></article>
        </div>
      </section>

      <section className="decisionScene">
        <div className="sectionNumber">03 / COMMUNICATION DECISION ENGINE</div>
        <div className="decisionHeader">
          <h2>DON'T ASK ONLY<br /><span>“WHAT SHOULD AI WRITE?”</span></h2>
          <p>Ask what the information means, who needs it, why now, and what form can move that audience to action.</p>
        </div>
        <div className="decisionTrack">
          {['WHAT HAPPENED?','WHO IS AFFECTED?','HOW URGENT?','WHO NEEDS TO KNOW?','WHAT SHOULD BE CREATED?'].map((x,i) => (
            <div className="decisionStep" key={x}>
              <span>0{i+1}</span>
              <strong>{x}</strong>
              {i < 4 && <i>→</i>}
            </div>
          ))}
        </div>
      </section>

      <section className="outputScene">
        <div className="sectionNumber">04 / OUTPUT DISCOVERY</div>
        <div className="outputHeader">
          <h2>ONE CONTEXT.<br /><em>MANY COMMUNICATIONS.</em></h2>
          <p>Same underlying intelligence. Different audience, channel, objective and tone.</p>
        </div>
        <div className="outputStage">
          {outputs.map((output, i) => (
            <Link href="/engine" className="outputPoster" key={output}>
              <span>0{i + 1}</span>
              <strong>{output}</strong>
              <small>GENERATE ↗</small>
              <div className="posterGlow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="livingScene">
        <div className="livingVisual" aria-hidden="true">
          <div className="livingCircle" />
          <div className="livingLine l1" />
          <div className="livingLine l2" />
          <div className="livingLine l3" />
          <span className="livingTag t1">CLAIMS</span>
          <span className="livingTag t2">CHANGE</span>
          <span className="livingTag t3">EVIDENCE</span>
          <span className="livingTag t4">AUDIENCE</span>
        </div>
        <div className="livingCopy">
          <div className="sectionNumber">05 / LIVING INFORMATION</div>
          <h2>INFORMATION<br /><em>CHANGES.</em></h2>
          <p>When the underlying facts change, INFORGE can identify affected claims, outputs and decisions instead of making you rebuild everything from scratch.</p>
          <div className="changeCard">
            <span>INFORMATION UPDATE</span>
            <strong>3 claims changed</strong>
            <b>2 outputs affected</b>
            <small>REVIEW CHANGES ↗</small>
          </div>
        </div>
      </section>

      <section className="finalCinema">
        <div className="finalWords">UNDERSTAND.<br />VERIFY.<br /><em>TRANSFORM.</em><br />ADAPT.</div>
        <div className="finalMeta">
          <span>INFORGE / INFORMATION INTELLIGENCE ENGINE</span>
          <span>BUILT FOR WHAT COMES NEXT.</span>
        </div>
        <Link href="/engine" className="finalButton">START A PROJECT <span>↗</span></Link>
      </section>
    </main>
  );
}
