'use client';

import * as React from 'react';
import { ScaffoldingForm } from '@/components/scaffolding/scaffolding-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScaffoldingPage() {
  const [toast, setToast] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleCreateField = async (data: {
    name: string;
    description?: string;
    fieldType: string;
  }) => {
    try {
      const response = await fetch('/api/scaffolding/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setToast({
          type: 'success',
          message: `Field "${data.name}" created successfully!`,
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        throw new Error(result.error || 'Failed to create field');
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create field',
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleRunScaffolding = async (fieldId: string) => {
    try {
      // Step 1: Get the search queries
      const response = await fetch('/api/scaffolding/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId }),
      });

      const result = await response.json();

      if (result.success) {
        // Download the queries as a JSON file for processing
        const queries = result.data.queries;
        const blob = new Blob([JSON.stringify(queries, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scaffolding-queries-${fieldId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setToast({
          type: 'success',
          message: `Generated ${queries.length} search queries. Download started. Use the CLI script to process them.`,
        });
        setTimeout(() => setToast(null), 5000);
      } else {
        throw new Error(result.error || 'Failed to generate queries');
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to run scaffolding',
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scaffolding</h1>
        <p className="text-muted-foreground">
          Use AI web search to retrieve and store custom financial metrics for all
          instruments in your portfolios.
        </p>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Alert
          variant={toast.type === 'error' ? 'destructive' : 'default'}
          className="mb-6"
        >
          <AlertDescription>{toast.message}</AlertDescription>
        </Alert>
      )}

      {/* How It Works */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Scaffolding Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="font-medium">Define Field</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Specify which financial metric you want to retrieve (e.g., EPS, Revenue,
                P/E Ratio)
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="font-medium">Run Search</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                AI performs web search for each instrument in your portfolios to find the
                metric value
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="font-medium">Store Data</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Values are parsed and stored in the database for analysis and reporting
              </p>
            </div>
          </div>

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> After clicking "Run Scaffolding", you'll download a JSON
              file with search queries. Use the CLI script{' '}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                scripts/run-scaffolding.ts
              </code>{' '}
              to process these queries with web search, or manually submit results via the
              API.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Main Form */}
      <ScaffoldingForm
        onSubmit={handleCreateField}
        onRunScaffolding={handleRunScaffolding}
      />

      {/* CLI Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            CLI Processing Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To process scaffolding queries with web search:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>
              {`# Using the CLI script
npx tsx scripts/run-scaffolding.ts <queries-file.json>

# Or manually with curl
curl -X POST http://localhost:3000/api/scaffolding/run/result \\
  -H "Content-Type: application/json" \\
  -d @results.json`}
            </code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
