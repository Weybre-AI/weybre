import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Construction, FileSearch, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Diligence = () => {
  return (
    <AppShell title="Diligence">
      <div className="container max-w-4xl px-4 py-12 sm:py-20">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <FileSearch className="h-8 w-8" />
          </div>
          <h2 className="font-serif text-3xl font-semibold text-primary sm:text-4xl">Diligence Module</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Automated legal due diligence and document matrix generation. We're currently finalizing the AI models for complex multi-document analysis.
          </p>
          
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <Card className="p-6 text-left">
              <h3 className="font-serif text-lg font-semibold text-primary">Document Matrix</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload a data room and generate a structured matrix of key clauses across 100+ documents simultaneously.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-accent">
                <Construction className="h-3 w-3" /> Coming soon
              </div>
            </Card>
            <Card className="p-6 text-left">
              <h3 className="font-serif text-lg font-semibold text-primary">Risk Aggregation</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Identify patterns of risk across your entire contract corpus and export a unified risk report.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-accent">
                <Construction className="h-3 w-3" /> Coming soon
              </div>
            </Card>
          </div>

          <div className="mt-12">
            <Button asChild variant="outline">
              <Link to="/app">
                Return to workspace <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Diligence;
