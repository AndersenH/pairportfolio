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

  const handleAutoRunScaffolding = async (fieldId: string) => {
    try {
      setToast({
        type: 'success',
        message: 'Starting automated scaffolding process...',
      });

      const response = await fetch('/api/scaffolding/run/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, maxSymbols: 50 }),
      });

      const result = await response.json();

      if (result.success) {
        const { successCount, nullCount, errorCount } = result.meta;
        setToast({
          type: 'success',
          message: `Scaffolding complete! Found: ${successCount}, Not found: ${nullCount}, Errors: ${errorCount}`,
        });
        setTimeout(() => setToast(null), 5000);
      } else {
        throw new Error(result.error || 'Failed to run automated scaffolding');
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to run automated scaffolding',
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
                Click "Auto Run" for automated web search, or "Manual" to download queries
                and process them with the CLI script
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
              <strong>Two Ways to Run:</strong> (1) Click "Auto Run" for instant automated web
              search processing. (2) Click "Manual" to download queries and process them with the
              CLI script{' '}
              <code className="px-1 py-0.5 bg-muted rounded text-xs">
                scripts/auto-scaffolding-cli.ts
              </code>{' '}
              for advanced control.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Main Form */}
      <ScaffoldingForm
        onSubmit={handleCreateField}
        onRunScaffolding={handleRunScaffolding}
        onAutoRunScaffolding={handleAutoRunScaffolding}
      />

      {/* CLI Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Advanced: CLI Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For advanced users who want more control over the search process:
          </p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            <code>
              {`# Method 1: Automated CLI (with Claude Code WebSearch)
claude run scripts/auto-scaffolding-cli.ts <fieldId>

# Method 2: Manual processing
# 1. Click "Manual" to download queries
# 2. Process with your own search implementation
npx tsx scripts/run-scaffolding.ts <queries-file.json>

# Method 3: Direct API call for automated processing
curl -X POST http://localhost:3000/api/scaffolding/run/auto \\
  -H "Content-Type: application/json" \\
  -d '{"fieldId": "your-field-id", "maxSymbols": 50}'`}
            </code>
          </pre>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended:</strong> Use the "Auto Run" button in the UI for the easiest
              experience. The CLI methods are for advanced use cases.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
