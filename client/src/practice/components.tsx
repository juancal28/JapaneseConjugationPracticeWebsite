import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { safeRubyHtml } from "@shared/ids";

/** Small presentational components ported 1:1 from the original quiz/*.js files. */

export function Toggle(props: {
  id: string;
  label: string;
  name?: string;
  checked: boolean;
  onToggle: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <li className="tgListItem">
      <h4>{props.label}</h4>
      <input className="tgl tglLight" id={props.id} name={props.name} checked={props.checked} onChange={props.onToggle} type="checkbox" />
      <label className="tglBtn" htmlFor={props.id}></label>
    </li>
  );
}

/** Inserts an empty <div> after every 4th child, acting as a line break (same as the original). */
export function ToggleList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="toggle-list">
      {React.Children.toArray(children).map((child, i) =>
        (i + 1) % 4 === 0 ? (
          <React.Fragment key={i}>
            {child}
            <div></div>
          </React.Fragment>
        ) : (
          child
        ),
      )}
    </ul>
  );
}

export function Settings({ legend = "Settings", id = "settings", children }: { legend?: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="settings">
      <fieldset>
        <legend>{legend}</legend>
        {children}
      </fieldset>
    </div>
  );
}

export function Question({ furi, children }: { furi: boolean; children: string }) {
  return (
    <div className={"question" + (furi ? " furi" : "")}>
      <ruby dangerouslySetInnerHTML={{ __html: safeRubyHtml(children) }}></ruby>
    </div>
  );
}

const getPercent = (c: number, i: number) => (i === 0 ? "100%" : Math.ceil((c / (c + i)) * 100).toString() + "%");

export function CorrectScore({ correct, incorrect }: { correct: number; incorrect: number }) {
  return (
    <h3 className="score">
      <span id="correct" className="correct">{correct}</span>/<span id="incorrect" className="incorrect">{incorrect}</span>/
      <span id="percent">{getPercent(correct, incorrect)}</span>
    </h3>
  );
}

export function Feedback({ answer, status }: { answer: string; status: string }) {
  return (
    <div className={"feedback status-" + (status || "none")}>
      <h2 id="correct-answer" dangerouslySetInnerHTML={{ __html: "Last Answer: " + safeRubyHtml(answer) }}></h2>
      <h2 id="meaning"></h2>
    </div>
  );
}

export function English({ english, show }: { english: string; show: boolean }) {
  return <h3 className={"english" + (show ? "" : " hidden")}>{english}</h3>;
}

export function Type({ label, hide }: { label: string; hide: boolean }) {
  return <h3 className={"type" + (hide ? " hidden" : "")}>{label} </h3>;
}

export function DarkModeButton() {
  const [theme, setTheme] = useState<string>(() => window.__theme);
  useEffect(() => {
    window.__onThemeChange = () => setTheme(window.__theme);
  }, []);
  return (
    <input
      type="checkbox"
      className="darkmode"
      checked={theme === "dark"}
      onChange={(e) => window.__setPreferredTheme(e.target.checked ? "dark" : "light")}
    />
  );
}

export function BackButton({ to }: { to: string }) {
  return (
    <Link to={to} className="back" title="Manage decks">
      &#8249;
    </Link>
  );
}
