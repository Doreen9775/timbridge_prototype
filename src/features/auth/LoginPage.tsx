import { useEffect, useState, type FormEvent } from "react";
import { TimbridgeLogo } from "@/components/shared/TimbridgeLogo";

// Right-side hero carousel. Drop the photos into public/login/ named 1.jpg, 2.jpg, 3.jpg…
// and extend this list to match. Missing files fall back to the dark panel behind them.
const HERO_IMAGES = ["/login/1.jpg", "/login/2.jpg", "/login/3.jpg"];
const ROTATE_MS = 5000;

// Prototype credentials — pre-filled so testers can sign in with one click.
const DEFAULT_EMAIL = "usertest@tbg.com";
const DEFAULT_PASSWORD = "123456";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

export function LoginPage({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [active, setActive] = useState(0);
  const [exiting, setExiting] = useState(false);

  // Cycle the hero image every 5s (no-op if there's only one).
  useEffect(() => {
    if (HERO_IMAGES.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % HERO_IMAGES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Fade the login out, then hand off to the app (which fades in) for a soft transition.
    setExiting(true);
    window.setTimeout(onSignIn, 450);
  };

  const inputCls =
    "w-full bg-[#F3F4F6] rounded-lg px-4 py-3 text-[15px] text-text placeholder:text-[#A6A6A6] placeholder:font-normal outline-none focus:ring-2 focus:ring-coral/40";

  return (
    <div className={`flex h-screen w-screen bg-white overflow-hidden transition-opacity duration-500 ${exiting ? "opacity-0" : "opacity-100"}`}>
      {/* Left — sign-in form */}
      <div className="w-full md:w-1/2 flex flex-col p-10 relative">
        <TimbridgeLogo className="w-[120px] h-auto" />

        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight">{greeting()}!</h1>
            <p className="font-normal text-[#979797] mt-3 mb-10">Let's get you signed in securely.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#202224] mb-2">Email address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Please enter your email address"
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-[#202224]">Password</label>
                <button type="button" className="text-sm font-bold text-lime hover:underline">Forgot Your Password?</button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Please enter your password"
                className={inputCls}
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold text-[#9A9B9C] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-ink cursor-pointer"
              />
              Remember Password
            </label>

            <button
              type="submit"
              className="w-full bg-ink text-white rounded-lg py-3.5 text-[15px] font-semibold mt-1 cursor-pointer transition-all duration-200 hover:bg-[#333333] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Sign In
            </button>
          </form>

          <p className="text-center text-sm font-semibold text-[#9A9B9C] mt-5">
            Don't have an account? <button type="button" className="font-bold text-lime hover:underline">Create Account</button>
          </p>
        </div>
      </div>

      {/* Right — rotating hero (hidden on small screens) */}
      <div className="hidden md:block md:w-1/2 relative overflow-hidden bg-ink">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-[1600ms] ease-in-out ${i === active ? "opacity-100" : "opacity-0"}`}
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
