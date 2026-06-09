import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">a11y-shiftleft demo</p>
          <h1>React accessibility CI playground</h1>
          <p className="lede">
            This page intentionally includes a few accessibility defects so the
            CLI can produce visible reports in local runs and pull requests.
          </p>
        </div>

        <form className="signup-panel">
          <h2>Newsletter</h2>
          <p className="muted">The input below has no accessible label.</p>
          <input type="email" placeholder="Email address" />
          <button className="primary-button" type="button">
            Join waitlist
          </button>
        </form>
      </section>

      <section className="audit-grid" aria-labelledby="audit-title">
        <h2 id="audit-title">Seeded issues</h2>

        <article>
          <h3>Missing image alternative text</h3>
          <img src="/sample-chart.svg" />
        </article>

        <article>
          <h3>Low contrast button</h3>
          <button className="low-contrast-button" type="button">
            Export report
          </button>
        </article>

        <article>
          <h3>Icon-only action with no name</h3>
          <button className="icon-button" type="button"></button>
        </article>

        <article>
          <h3>Stateful modal issue</h3>
          <p className="muted">Explore mode can open this dialog and scan the new UI state.</p>
          <button
            className="secondary-button"
            type="button"
            data-a11y-explore
            onClick={() => setIsModalOpen(true)}
          >
            Open audit modal
          </button>
        </article>
      </section>

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="audit-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Audit export settings</h2>
              <button
                className="icon-button modal-close"
                type="button"
                onClick={() => setIsModalOpen(false)}
              ></button>
            </div>
            <p className="muted">
              This dialog intentionally includes accessibility defects for demo scans.
            </p>
            <input type="text" placeholder="Report name" />
            <button className="low-contrast-button" type="button">
              Preview report
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
