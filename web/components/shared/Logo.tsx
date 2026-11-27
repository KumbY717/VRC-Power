import { Zap } from "lucide-react";

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-ink">
        <Zap size={22} fill="currentColor" strokeWidth={1.5} />
      </span>
      <span className="font-heading text-xl font-bold leading-none">
        VRC <span className="text-lime">Power</span>
      </span>
    </div>
  );
}
