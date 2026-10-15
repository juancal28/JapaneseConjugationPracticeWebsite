import React from "react";
import { ADJ_FORMS, VERB_FORMS, type FormDef } from "@shared/conjugation/forms";
import { TYPE_LABELS, type Word, type WordAnswers } from "@shared/types";
import { BackButton, CorrectScore, DarkModeButton, English, Feedback, Question, Settings, Toggle, ToggleList, Type } from "./components";
import UserInput from "./UserInput";
import { Randomizer, generateItem } from "./randomizer";

interface Props {
  title: string;
  words: Word[];
  answers: Record<string, WordAnswers>;
  hasVerbs: boolean;
  hasAdjs: boolean;
  /** Rendered below the Settings fieldset (the Decks picker). */
  children?: React.ReactNode;
}

interface State {
  word: Word | null;
  question: string;
  lastAnswer: string;
  form: string;
  status: string;
  wait: boolean;
  correct: number;
  incorrect: number;
  kanji: boolean;
  furi: boolean;
  type: boolean;
  opts: Record<string, boolean>;
  reverse: boolean;
  showEnglish: boolean;
  randomQuestion: boolean;
}

/** A saved toggle, or `fallback` if it was never set. */
const stored = (key: string, fallback = false) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
};
const store = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable (private mode); settings just won't persist.
  }
};

/**
 * Port of the original layouts/conjugation.js (randomize mode) + quiz_master.js.
 * Kept as a class with mutable fields like the original so the update order matches.
 */
export default class Conjugation extends React.Component<Props, State> {
  private word: Word | null = null;
  private lastword: Word | undefined = undefined;
  private answer: string[] = [];
  private previousAnswers: string[] = [];
  private kanaAnswer: string[] = [];
  private kanjiAnswer: string[] = [];
  /** Ruby markup of the accepted answers, shown in the Last Answer box. */
  private answerKanji: string[] = [];
  // Unlike the original, kanji with furigana is the default.
  private kanji = stored("showKanji", true);
  private furi = stored("showFuri", true);
  private type = stored("hideType");
  private showEnglish = stored("showEnglish");
  private correct = 0;
  private incorrect = 0;
  private opts: Record<string, boolean> = {};
  private reverse: boolean;
  private randomQuestion = false;
  private randomizer: Randomizer;

  constructor(props: Props) {
    super(props);
    const params = new URLSearchParams(window.location.search);
    for (const f of [...VERB_FORMS, ...ADJ_FORMS]) this.opts[f.id] = params.get(f.id) === "true";
    this.reverse = params.get("reverse") === "true";
    this.randomizer = new Randomizer(props.answers);
    this.state = {
      word: null,
      question: "",
      lastAnswer: "",
      form: "",
      status: "",
      wait: false,
      correct: 0,
      incorrect: 0,
      kanji: this.kanji,
      furi: this.furi,
      type: this.type,
      opts: this.opts,
      reverse: this.reverse,
      showEnglish: this.showEnglish,
      randomQuestion: false,
    };
  }

  newWord = () => {
    let pool = this.props.words.filter((x) => !this.previousAnswers.includes(x.id));
    if (pool.length === 0) pool = this.props.words;
    this.word = generateItem(pool, this.lastword);
    this.lastword = this.word;
    this.setState({ word: this.word, wait: false, status: "" });
    this.updateQuestion();
    this.updateAnswer();
  };

  updateQuestion() {
    const word = this.word!;
    let question = word.kana;
    if (this.kanji) {
      question = word.kanji.replace("<rt>", "<rp>(</rp><rt>").replace("</rt>", "</rt><rp>)</rp>");
    }
    if (this.randomQuestion) {
      question = this.randomizer.getQuestion(word, this.kanji, this.opts);
    }
    this.setState({ question });
  }

  updateAnswer() {
    const answer = this.randomizer.getAnswer(this.word!, this.opts);
    if (!answer) {
      this.newWord();
      return;
    }
    this.answer = answer.kana;
    this.kanaAnswer = answer.kana;
    this.kanjiAnswer = answer.kanji;
    this.answerKanji = answer.kanji;
    if (this.reverse) this.updateReverse();
    this.setState({ form: this.randomizer.getForm() });
  }

  updateReverse() {
    const options = this.kanji ? this.kanjiAnswer : this.kanaAnswer;
    const question = options[Math.floor(Math.random() * options.length)];
    this.answer = [this.word!.kana];
    this.answerKanji = [this.word!.kanji];
    this.setState({ question });
  }

  checkAnswer = (userAnswer: string) => {
    let status: "correct" | "incorrect" = "incorrect";
    const word = this.word!;
    if (this.answer.includes(userAnswer)) {
      status = "correct";
      if (!this.previousAnswers.includes(word.id)) this.previousAnswers.push(word.id);
      if (this.previousAnswers.length === this.props.words.length) this.previousAnswers = [];
    }
    this[status] += 1;
    this.setState({
      status,
      correct: this.correct,
      incorrect: this.incorrect,
      // Kanji with furigana on top; each answer gets its own <ruby> so the readings line up.
      lastAnswer: this.answerKanji.map((a) => `<ruby>${a}</ruby>`).join(" or "),
      wait: true,
    });
  };

  englishToggle = () => {
    this.showEnglish = !this.showEnglish;
    store("showEnglish", this.showEnglish);
    this.setState({ showEnglish: this.showEnglish });
  };

  typeToggle = () => {
    this.type = !this.type;
    store("hideType", this.type);
    this.setState({ type: this.type });
  };

  optToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.opts[e.target.name] = !this.opts[e.target.name];
    this.setState({ opts: { ...this.opts } });
    this.updateQuestion();
    this.updateAnswer();
  };

  kanjiToggle = () => {
    this.kanji = !this.kanji;
    store("showKanji", this.kanji);
    this.setState({ kanji: this.kanji });
    if (!this.kanji) {
      this.furi = false;
      store("showFuri", false);
      this.setState({ furi: false });
    }
    this.updateQuestion();
    if (this.reverse) this.updateReverse();
  };

  furiToggle = () => {
    this.furi = !this.furi;
    store("showFuri", this.furi);
    if (this.furi) {
      this.kanji = true;
      store("showKanji", true);
      this.setState({ kanji: true });
      this.updateQuestion();
      if (this.reverse) this.updateReverse();
    }
    this.setState({ furi: this.furi });
  };

  randomQuestionToggle = () => {
    this.randomQuestion = !this.randomQuestion;
    if (this.randomQuestion) this.reverse = false;
    this.setState({ randomQuestion: this.randomQuestion, reverse: this.reverse });
    this.updateQuestion();
  };

  reverseToggle = () => {
    this.reverse = !this.reverse;
    if (this.reverse) this.randomQuestion = false;
    this.setState({ reverse: this.reverse, randomQuestion: this.randomQuestion });
    this.newWord();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    // Shift toggles furigana, but only while Show Kanji is on.
    if (e.key === "Shift" && this.state.kanji) this.furiToggle();
  };

  componentDidMount() {
    this.newWord();
    document.addEventListener("keydown", this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private formToggles(forms: FormDef[], prefix: boolean) {
    return forms.map((f) => (
      <Toggle
        key={f.id}
        id={f.id + "setting"}
        label={(prefix ? f.toggleLabel : f.label) + " Form"}
        name={f.id}
        onToggle={this.optToggle}
        checked={this.state.opts[f.id]}
      />
    ));
  }

  render() {
    const { hasVerbs, hasAdjs } = this.props;
    const word = this.state.word;
    return (
      <div className="qm-body">
        <BackButton to="/decks" />
        <div className="qm-content">
          <h1 className="qm-heading">{this.props.title}</h1>
          <Question furi={this.state.furi}>{this.state.question}</Question>
          <h3 id="random" style={{ margin: 0 }}>
            {this.state.form + " Form"}
          </h3>
          <English english={word?.eng ?? ""} show={this.state.showEnglish} />
          <UserInput wait={this.state.wait} status={this.state.status} onSubmit={this.checkAnswer} onClear={this.newWord} />
          <div>
            <Type label={word ? TYPE_LABELS[word.type] : ""} hide={this.state.type} />
          </div>
          <CorrectScore correct={this.state.correct} incorrect={this.state.incorrect} />
          <Feedback answer={this.state.lastAnswer} status={this.state.status} />
          <Settings>
            {hasVerbs && <ToggleList>{this.formToggles(VERB_FORMS, false)}</ToggleList>}
            {hasAdjs && <ToggleList>{this.formToggles(ADJ_FORMS, hasVerbs)}</ToggleList>}
            <ToggleList>
              <Toggle id="reversesetting" label="Reverse (Q⇄A)" checked={this.state.reverse} onToggle={this.reverseToggle} />
              <Toggle
                id="randomquestionsetting"
                label="Randomize Question (Beta)"
                checked={this.state.randomQuestion}
                onToggle={this.randomQuestionToggle}
              />
            </ToggleList>
            <ToggleList>
              <Toggle id="kanjisetting" label="Show Kanji" checked={this.state.kanji} onToggle={this.kanjiToggle} />
              <Toggle id="furisetting" label="Show Furigana (Shift)" checked={this.state.furi} onToggle={this.furiToggle} />
              <Toggle id="typesetting" label="Hide Type" checked={this.state.type} onToggle={this.typeToggle} />
              <div></div>
              <Toggle id="englishsetting" label="Show English" checked={this.state.showEnglish} onToggle={this.englishToggle} />
            </ToggleList>
          </Settings>
          {this.props.children}
        </div>
        <div className="qm-buttons">
          <DarkModeButton />
        </div>
      </div>
    );
  }
}
