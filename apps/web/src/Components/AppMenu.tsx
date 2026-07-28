import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import LokPulseLogo from "./LokPulseLogo";
import ThemeToggle from "./ThemeToggle";

const links = [
  { to: "/provinces", label: "Provinces" },
  { to: "/parties", label: "Parties" },
  { to: "/constituency", label: "Constituencies" },
  { to: "/maps", label: "Map" },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    isActive
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  ].join(" ");

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex min-h-11 items-center rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
  ].join(" ");

const NavigationMenu = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };

    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;

    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousHtmlOverflow = htmlStyle.overflow;
    const focusFrame = window.requestAnimationFrame(() => firstMobileLinkRef.current?.focus());

    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      bodyStyle.overflow = previousBodyOverflow;
      htmlStyle.overflow = previousHtmlOverflow;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 shadow-[0_1px_2px_rgb(15_23_42/0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/85 dark:bg-background/85 dark:shadow-none">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 lg:px-8">
        <NavLink
          to="/popular"
          className="group flex shrink-0 items-center gap-2.5 justify-self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="LokPulse home"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center text-foreground transition-transform group-hover:-translate-y-0.5">
            <LokPulseLogo className="h-10 w-10" />
          </span>
          <span className="leading-none">
            <span className="block text-sm font-semibold tracking-[-0.02em] text-foreground">
              LokPulse
            </span>
            <span className="mt-1 hidden items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:flex">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand dark:hidden" />
              Election 2082
            </span>
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 lg:flex lg:justify-self-center" aria-label="Primary navigation">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} className={desktopLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:justify-self-end">
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-[4.5rem] z-40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />
          <div className="relative border-b border-border bg-card shadow-lg">
            <nav
              id="mobile-navigation"
              className="mx-auto grid w-full max-w-[1600px] gap-2 px-4 py-4 sm:px-6"
              aria-label="Mobile navigation"
            >
              {links.map((item, index) => (
                <NavLink
                  key={item.to}
                  ref={index === 0 ? firstMobileLinkRef : undefined}
                  to={item.to}
                  className={mobileLinkClass}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
};

const AppMenu = () => <NavigationMenu />;

export default AppMenu;
