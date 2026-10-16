import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "../components/ui/button";
import { BrandLockup } from "../components/brand/BrandLockup";
import { WaveBackground } from "../components/brand/WaveBackground";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-4">
      <WaveBackground opacity={0.6} />
      <div className="relative w-full max-w-md rounded-3xl border border-token bg-surface p-8 text-center shadow-card sm:p-10">
        <div className="flex justify-center">
          <BrandLockup />
        </div>
        <div className="mx-auto mt-6 grid size-16 place-items-center rounded-2xl bg-volt/10 text-volt">
          <Compass className="size-8" aria-hidden="true" />
        </div>
        <p className="mt-6 font-display text-sm font-bold uppercase tracking-[0.2em] text-subtle">
          404
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The page you are looking for does not exist or has moved.
        </p>
        <Button asChild className="mt-6 w-full font-display">
          <Link to="/">Go to my dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
