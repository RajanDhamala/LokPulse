import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/popular", label: "Popular" },
  { to: "/provinces", label: "Provinces" },
  { to: "/parties", label: "Parties" },
  { to: "/constituency", label: "Constituency" },
  { to: "/maps", label: "Maps" }
];

const AppMenu = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;

    const previous = {
      bodyPosition: bodyStyle.position,
      bodyTop: bodyStyle.top,
      bodyLeft: bodyStyle.left,
      bodyRight: bodyStyle.right,
      bodyWidth: bodyStyle.width,
      bodyOverflow: bodyStyle.overflow,
      bodyTouchAction: bodyStyle.touchAction,
      htmlOverflow: htmlStyle.overflow,
      htmlOverscrollBehavior: htmlStyle.overscrollBehavior
    };

    // Lock document scrolling while the mobile drawer is open.
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    bodyStyle.touchAction = "none";
    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "none";

    return () => {
      bodyStyle.position = previous.bodyPosition;
      bodyStyle.top = previous.bodyTop;
      bodyStyle.left = previous.bodyLeft;
      bodyStyle.right = previous.bodyRight;
      bodyStyle.width = previous.bodyWidth;
      bodyStyle.overflow = previous.bodyOverflow;
      bodyStyle.touchAction = previous.bodyTouchAction;
      htmlStyle.overflow = previous.htmlOverflow;
      htmlStyle.overscrollBehavior = previous.htmlOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card/90 text-foreground shadow-md backdrop-blur transition hover:bg-muted"
        aria-label="Toggle navigation menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/45"
          onClick={() => setOpen(false)}
        >
          <aside
            className="h-full w-64 border-r border-border/70 bg-background/95 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-4 mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Navigate</p>
            <nav className="space-y-2">
              {links.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground transition hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
};

export default AppMenu;
