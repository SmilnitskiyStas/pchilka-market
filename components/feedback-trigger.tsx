'use client';

export default function FeedbackTrigger() {
  return <button type="button" className="footer-feedback" onClick={() => window.dispatchEvent(new Event('pchilka:open-feedback'))}>Напишіть нам</button>;
}
