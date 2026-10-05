import { StrictMode, Component } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "./index.css";
import App from "./App.jsx";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "./constants/branding.js";

document.title = PLATFORM_NAME;
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) {
  metaDesc.setAttribute("content", `${PLATFORM_NAME} — ${PLATFORM_TAGLINE}`);
}

/**
 * Top-level error boundary.
 * Catches render crashes and shows a readable error instead of a blank page.
 * Remove in production or replace with a proper error-reporting service.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 mesh-bg p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <Card className="w-full max-w-lg border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Something crashed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-muted p-3 rounded-lg text-xs text-destructive max-w-full overflow-auto whitespace-pre-wrap break-words text-left">
              {this.state.error?.message}
            </pre>
            <Button variant="gradient" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>
);
