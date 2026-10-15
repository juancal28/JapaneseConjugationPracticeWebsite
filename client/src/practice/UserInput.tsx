import { useCallback, useEffect, useRef, useState } from "react";
import { bind, isHiragana } from "wanakana";

/** Port of the original quiz/user-input.js: wanakana IME, Enter anywhere to submit/advance. */
export default function UserInput(props: {
  wait: boolean;
  status: string;
  onSubmit: (value: string) => void;
  onClear: () => void;
}) {
  const [isShaking, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { wait, onSubmit, onClear } = props;

  const shake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const clear = useCallback(() => {
    inputRef.current!.value = "";
    onClear();
  }, [onClear]);

  const validateInput = useCallback(() => {
    const input = inputRef.current!;
    let value = input.value;
    if (isHiragana(value.slice(0, -1)) && value.slice(-1) === "n") {
      value = value.slice(0, -1) + "ん";
      input.value = value;
    }
    if (wait) clear();
    else if (isHiragana(value) && value !== "" && value.length <= 50) onSubmit(value);
    else shake();
  }, [clear, wait, onSubmit]);

  useEffect(() => {
    bind(inputRef.current!);
    inputRef.current!.focus();
  }, []);

  useWindowListener("click", () => {
    if (inputRef.current && window.innerWidth > 650) inputRef.current.focus();
  });
  useWindowListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") validateInput();
  });

  return (
    <input
      ref={inputRef}
      id="input-IME"
      className={["inputIME", props.status, isShaking ? "shake" : ""].filter(Boolean).join(" ")}
      autoCorrect="off"
      autoCapitalize="none"
    />
  );
}

function useWindowListener(eventName: string, handler: (e: Event) => void) {
  const saved = useRef(handler);
  useEffect(() => {
    saved.current = handler;
  }, [handler]);
  useEffect(() => {
    const listener = (e: Event) => saved.current(e);
    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [eventName]);
}
