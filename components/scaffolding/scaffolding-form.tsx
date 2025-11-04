'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  AlertCircle,
  CheckCircle,
  Database,
  Play,
  Info,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/client-utils';

const scaffoldingFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  description: z.string().optional(),
  fieldType: z.enum(['numeric', 'text', 'percentage', 'currency']).default('numeric'),
});

type ScaffoldingFieldFormData = z.infer<typeof scaffoldingFieldSchema>;

interface ScaffoldingFormProps {
  onSubmit: (data: ScaffoldingFieldFormData) => Promise<void>;
  onRunScaffolding?: (fieldId: string) => Promise<void>;
  isLoading?: boolean;
}

export function ScaffoldingForm({
  onSubmit,
  onRunScaffolding,
  isLoading = false,
}: ScaffoldingFormProps) {
  const [fields, setFields] = React.useState<any[]>([]);
  const [isLoadingFields, setIsLoadingFields] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState<string | null>(null);

  const form = useForm<ScaffoldingFieldFormData>({
    resolver: zodResolver(scaffoldingFieldSchema),
    defaultValues: {
      name: '',
      description: '',
      fieldType: 'numeric',
    },
  });

  // Load existing fields
  const loadFields = React.useCallback(async () => {
    setIsLoadingFields(true);
    try {
      const response = await fetch('/api/scaffolding/fields');
      const data = await response.json();
      if (data.success) {
        setFields(data.data);
      }
    } catch (error) {
      console.error('Failed to load fields:', error);
    } finally {
      setIsLoadingFields(false);
    }
  }, []);

  React.useEffect(() => {
    loadFields();
  }, [loadFields]);

  const handleSubmit = async (data: ScaffoldingFieldFormData) => {
    await onSubmit(data);
    form.reset();
    loadFields();
  };

  const handleRunScaffolding = async (fieldId: string) => {
    if (onRunScaffolding) {
      setIsRunning(fieldId);
      try {
        await onRunScaffolding(fieldId);
      } finally {
        setIsRunning(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Field Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Create Scaffolding Field
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Field Name</label>
                <Input
                  {...form.register('name')}
                  placeholder="e.g., EPS, Revenue, P/E Ratio"
                  className="mt-1"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  The financial metric you want to retrieve
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Field Type</label>
                <select
                  {...form.register('fieldType')}
                  className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md"
                >
                  <option value="numeric">Numeric</option>
                  <option value="text">Text</option>
                  <option value="percentage">Percentage</option>
                  <option value="currency">Currency</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                {...form.register('description')}
                placeholder="e.g., Earnings per share for the most recent quarter"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Helps improve search accuracy
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Scaffolding uses AI web search to find and store the specified financial
                metric for all instruments in your portfolios.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Create Field
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Existing Scaffolding Fields
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingFields ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No scaffolding fields created yet</p>
              <p className="text-sm">Create your first field above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="p-4 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{field.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {field.fieldType}
                        </Badge>
                        {field.isActive ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-sm text-muted-foreground">{field.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          Data points: {field._count?.data || 0}
                        </span>
                        <span>
                          Created: {new Date(field.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunScaffolding(field.id)}
                      disabled={!field.isActive || isRunning === field.id}
                    >
                      {isRunning === field.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run Scaffolding
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
